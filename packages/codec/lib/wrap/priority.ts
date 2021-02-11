import * as Format from "@truffle/codec/format";
import { AddressLikeType, NumericType, TupleLikeType } from "./types";
import { Mutability } from "@truffle/codec/common";
import { maxValue, minValue, places } from "./utils";

//is input 1 more specific than input 2? (nonstrict)
export function isMoreSpecificMultiple(
  types1: Format.Types.OptionallyNamedType[],
  types2: Format.Types.OptionallyNamedType[],
  userDefinedTypes: Format.Types.TypesById
): boolean {
  //just wrap the types in tuples and defer to isMoreSpecific()
  const combinedType1: Format.Types.TupleType = {
    typeClass: "tuple",
    memberTypes: types1
  };
  const combinedType2: Format.Types.TupleType = {
    typeClass: "tuple",
    memberTypes: types2
  };
  return isMoreSpecific(combinedType1, combinedType2, userDefinedTypes);
}

//is input 1 more specific than input 2?
//(this is nonstrict)
export function isMoreSpecific(
  type1: Format.Types.Type,
  type2: Format.Types.Type,
  userDefinedTypes: Format.Types.TypesById
): boolean {
  const typeClasses = [
    ["address", "contract"],
    ["array"],
    ["function"],
    ["options"],
    ["struct", "tuple"],
    ["bytes"],
    ["uint", "int", "fixed", "ufixed"],
    ["enum"],
    ["string"],
    ["bool"]
  ];
  //for each type, what's the first one it counts as?
  const index1 = typeClasses.findIndex(classes =>
    classes.includes(type1.typeClass)
  );
  const index2 = typeClasses.findIndex(classes =>
    classes.includes(type2.typeClass)
  );
  //NOTE: I am assuming neither will be -1!
  //If either is, something has gone very wrong!
  if (index1 < index2) {
    return true;
  } else if (index2 < index1) {
    return false;
  }
  //otherwise, indices are equal, defer to tiebreaker
  switch (type1.typeClass) {
    case "address":
    case "contract":
      return isMoreSpecificAddress(type1, <AddressLikeType>type2);
    case "array":
      return isMoreSpecificArray(
        type1,
        <Format.Types.ArrayType>type2,
        userDefinedTypes
      );
    case "bytes":
      return isMoreSpecificBytes(type1, <Format.Types.BytesType>type2);
    case "uint":
    case "int":
    case "fixed":
    case "ufixed":
      return isMoreSpecificNumeric(type1, <NumericType>type2);
    case "enum":
      return isMoreSpecificEnum(type1, <Format.Types.EnumType>type2);
    case "string":
      return isMoreSpecificString(type1, <Format.Types.StringType>type2);
    case "function":
      return isMoreSpecificFunction(
        //we haven't actually checked visibility, so we'll have to coerce
        <Format.Types.FunctionExternalType>type1,
        <Format.Types.FunctionExternalType>type2,
        userDefinedTypes
      );
    case "options":
      return isMoreSpecificOptions(type1, <Format.Types.OptionsType>type2);
    case "struct":
    case "tuple":
      return isMoreSpecificTuple(
        type1,
        <Format.Types.TupleType>type2,
        userDefinedTypes
      );
    case "bool":
      return isMoreSpecificBool(type1, <Format.Types.BoolType>type2);
  }
}

function isMoreSpecificAddress(
  type1: AddressLikeType,
  type2: AddressLikeType
): boolean {
  //address payable more specific than address
  //contract types more specific than address
  //*payable* contract types more specific than address payable
  if (type1.typeClass === "address" && type2.typeClass === "address") {
    if (type1.kind === "specific" && type2.kind === "specific") {
      return type1.payable || !type2.payable;
    } else if (type2.kind === "general") {
      //specific is more specific than general :P
      return true;
    }
  }
  if (type1.typeClass === "contract" && type2.typeClass === "contract") {
    if (type1.kind === "native" && type2.kind === "native") {
      return type1.id === type2.id;
    } //foreign contract types will always be incomparable, I guess?
    //(they shouldn't come up here anyway)
  }
  if (type1.typeClass === "contract" && type2.typeClass === "address") {
    return (
      type2.kind === "general" ||
      (type2.kind === "specific" && !type2.payable) ||
      (type2.kind === "specific" && type1.payable)
    );
  }
  return false; //otherwise
}

function isMoreSpecificBytes(
  type1: Format.Types.BytesType,
  type2: Format.Types.BytesType
): boolean {
  //static more specific than dynamic, with shorter
  //lengths more specific than longer ones
  return (
    (type1.kind === "dynamic" && type2.kind === "dynamic") ||
    (type1.kind === "static" && type2.kind === "dynamic") ||
    (type1.kind === "static" &&
      type2.kind === "static" &&
      type1.length <= type2.length)
  );
}

function isMoreSpecificNumeric(
  type1: NumericType,
  type2: NumericType
): boolean {
  return (
    maxValue(type1).lte(maxValue(type2)) &&
    minValue(type1).gte(minValue(type2)) &&
    places(type1) <= places(type2)
  );
}

function isMoreSpecificEnum(
  type1: Format.Types.EnumType,
  type2: Format.Types.EnumType
): boolean {
  //different enum types are incomparable
  return type1.id === type2.id;
}

function isMoreSpecificString(
  _type1: Format.Types.StringType,
  _type2: Format.Types.StringType
): boolean {
  //only one string type
  return true;
}

function isMoreSpecificArray(
  type1: Format.Types.ArrayType,
  type2: Format.Types.ArrayType,
  userDefinedTypes: Format.Types.TypesById
): boolean {
  //static is more specific than dynamic, but
  //different static lengths are incomparable
  const moreSpecificLength: boolean =
    (type1.kind === "dynamic" && type2.kind === "dynamic") ||
    (type1.kind === "static" && type2.kind === "dynamic") ||
    (type1.kind === "static" &&
      type2.kind === "static" &&
      type1.length.eq(type2.length));
  //length and types must both be more specific
  return (
    moreSpecificLength &&
    isMoreSpecific(type1.baseType, type2.baseType, userDefinedTypes)
  );
}

function isMoreSpecificFunction(
  type1: Format.Types.FunctionExternalType,
  type2: Format.Types.FunctionExternalType,
  userDefinedTypes?: Format.Types.TypesById
): boolean {
  switch (type2.kind) {
    case "general":
      return true;
    case "specific":
      switch (type1.kind) {
        case "general":
          return false;
        case "specific":
          //now: if they're both specific...
          //(this case doesn't really matter, but let's do it anyway)
          if (!isMutabilityMoreSpecific(type1.mutability, type2.mutability)) {
            return false;
          }
          if (
            type1.outputParameterTypes.length !==
            type2.outputParameterTypes.length
          ) {
            return false;
          }
          for (let i = 0; i < type1.outputParameterTypes.length; i++) {
            if (
              !isMoreSpecific(
                type1.outputParameterTypes[i],
                type2.outputParameterTypes[i],
                userDefinedTypes
              )
            ) {
              return false;
            }
          }
          if (
            type1.inputParameterTypes.length !==
            type2.inputParameterTypes.length
          ) {
            return false;
          }
          for (let i = 0; i < type1.inputParameterTypes.length; i++) {
            if (
              !isMoreSpecific(
                //swapped for contravariance, I guess...?
                type2.inputParameterTypes[i],
                type1.inputParameterTypes[i],
                userDefinedTypes
              )
            ) {
              return false;
            }
          }
          return true;
      }
  }
}

function isMutabilityMoreSpecific(
  mutability1: Mutability,
  mutability2: Mutability
) {
  //pure <= view <= nonpayable, payable <= nonpayable
  return (
    mutability1 === mutability2 ||
    (mutability1 === "pure" && mutability2 !== "payable") ||
    mutability2 === "nonpayable"
  );
}

function isMoreSpecificTuple(
  type1: TupleLikeType,
  type2: TupleLikeType,
  userDefinedTypes: Format.Types.TypesById
): boolean {
  const types1: Format.Types.Type[] = (<Format.Types.OptionallyNamedType[]>(
    (<TupleLikeType>Format.Types.fullType(type1, userDefinedTypes)).memberTypes
  )).map(member => member.type);
  const types2: Format.Types.Type[] = (<Format.Types.OptionallyNamedType[]>(
    (<TupleLikeType>Format.Types.fullType(type2, userDefinedTypes)).memberTypes
  )).map(member => member.type);
  //lengths must match
  if (types1.length !== types2.length) {
    return false;
  }
  //individual types must satisfy isMoreSpecific
  for (let i = 0; i < types1.length; i++) {
    if (!isMoreSpecific(types1[i], types2[i], userDefinedTypes)) {
      return false;
    }
  }
  //finally: structs more specific than tuples, different equivalent
  //structs incomparable
  return (
    (type1.typeClass === "tuple" && type2.typeClass === "tuple") ||
    (type1.typeClass === "struct" && type2.typeClass === "tuple") ||
    (type1.typeClass === "struct" &&
      type2.typeClass === "struct" &&
      type1.id === type2.id)
  );
}

function isMoreSpecificOptions(
  _type1: Format.Types.OptionsType,
  _type2: Format.Types.OptionsType
): boolean {
  //only one options type
  return true;
}

function isMoreSpecificBool(
  _type1: Format.Types.BoolType,
  _type2: Format.Types.BoolType
): boolean {
  //only one boolean type
  return true;
}

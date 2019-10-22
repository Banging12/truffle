//So, what shall codec export...?

//First: export the data format
import * as Format from "@truffle/codec/format";
export { Format };

//next: export all the utils!
//you can't do "export * as Name" for whatever reason so...
import * as Utils from "./utils";
export { Utils };

//now... various low-level stuff we want to export!
//the actual decoding functions and related errors
export { decodeVariable, decodeEvent, decodeCalldata } from "./core/decoding";
export { DecodingError, StopDecodingError } from "./decode/errors";

//the debugger needs to get its allocations, and deal with storage sizes
export { UnknownBaseContractIdError, getStorageAllocations, storageSize } from "./allocate/storage";
export { getAbiAllocations } from "./allocate/abi";
export { getMemoryAllocations } from "./allocate/memory";
//and to read the stack
export { readStack } from "./read/stack";

//finally, let's export the low-level encoding functions, because why not, someone
//might want them :P
export { encodeAbi, encodeTupleAbi } from "./encode/abi";
export { encodeMappingKey } from "./encode/key";
//(actually we use at least one of these in tests atm so we'd better export!)

//now: what types should we export? (other than the ones from ./format)
//public-facing types for the interface
export * from "./decode/types"; //all the decoding result types
export { UnknownUserDefinedTypeError } from "./common/types"; //the various errors we might throw

//for those who want more low-level stuff...
export { AstNode, AstNodes } from "./ast/types";
export { DataPointer } from "./pointer/types";
export { EvmInfo } from "./evm/types";
export { StorageAllocations, AbiAllocations, MemoryAllocations } from "./allocate/types";
export { StorageLength } from "./storage/types";

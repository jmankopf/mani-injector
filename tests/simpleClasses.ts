import 'reflect-metadata';
import {Inject, InjectId, InjectType, Parameter} from '../src/injector';
import {CircularB} from './circularB';

export class DependencyA {
    idA = 'DependencyA';
}

export class DependencyB {
    idB = 'DependencyB';
}

export interface Options {

}

export class DependantA {
    constructor(
        @Parameter readonly options: Options,
        @Inject readonly depA: DependencyA,
        @Inject readonly depB1: DependencyB,
        @InjectId('id') readonly depB2: DependencyB,
    ) {
    }
}

export class SimpleA {
    static instanceCounter = 0;

    constructor() {
        SimpleA.instanceCounter++;
    }

    emptyMethodA() {
    }
}

export class SimpleB {
    static instanceCounter = 0;

    constructor(@Inject readonly a: SimpleA) {
        SimpleB.instanceCounter++;
    }

    emptyMethodB() {
    }
}

export class SimpleC {
    static instanceCounter = 0;
    id = 1;

    constructor(
        @Inject readonly a: SimpleA,
        @Inject readonly b: SimpleB,
    ) {
        SimpleC.instanceCounter++;
    }

    emptyMethodC() {

    }

}

export class SimpleId {
    constructor(
        @InjectId('one') readonly a1: SimpleA,
        @InjectId('two') readonly a2: SimpleA,
    ) {
        SimpleC.instanceCounter++;
    }
}

export const symbol1 = Symbol();
export const symbol2 = Symbol('symbol2');

export class SimpleSymbol {
    constructor(
        @InjectId(symbol1) readonly a1: SimpleA,
        @InjectId(symbol2) readonly a2: SimpleA,
    ) {
        SimpleC.instanceCounter++;
    }
}

export interface SimpleType {
    value: string;
}

export class SimpleTypeImpl implements SimpleType {
    value: string = 'impl';

}

export class SimpleTypeImplB implements SimpleType {
    value: string = 'impl';

    constructor(
        @Inject readonly a: SimpleA,
        @Inject readonly b: SimpleB,
    ) {
    }
}

export class SimpleTypeUser {

    constructor(
        @InjectType(symbol1) readonly simpleType: SimpleType
    ) {
    }
}

export type Params = {
    param1: number, param2: number;
}

export interface SimpleParamInterface {
}

export class SimpleParam implements SimpleParamInterface {
    constructor(
        @Parameter readonly params: Params,
        @Inject readonly a: SimpleA,
        @Inject readonly b: SimpleB,
    ) {
    }
}

export class CircularA {
    constructor(@Inject readonly circularB: CircularB) {
    }
}

export class Primitives {
    constructor(
        @Inject readonly string: string,
        @Inject readonly number: number,
        @Inject readonly boolean: boolean,
    ) {
    }
}

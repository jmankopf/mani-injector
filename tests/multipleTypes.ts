import 'reflect-metadata';
import {InjectType} from '../src/injector';


export class MultiTypeA {

}

export class MultiTypeB {
    constructor(
        @InjectType('typeA') readonly multiTypeA: MultiTypeA
    ) {
    }
}


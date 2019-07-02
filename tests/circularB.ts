import {Inject} from '../src/injector';
import {CircularA} from './simpleClasses';

export class CircularB {
    constructor(@Inject readonly circularA: CircularA) {
    }
}


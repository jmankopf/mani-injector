import {Inject, Injector} from '../src/injector';

class Foo {}

class Bar {}

class FooBar {
    constructor(
        @Inject readonly foo: Foo,
        @Inject readonly bar: Bar
    ) {}
}

const injector = new Injector();

injector.map(Foo);               // default mapping is instance mapping which means that every time the class is requested/injected, a new instance is created
injector.map(Bar).toSingleton(); // Bar is only created once and that instance is injected everywhere
injector.map(FooBar);            // we want a new instance of FooBar each time

const fooBar1 = injector.get(FooBar);
const fooBar2 = injector.get(FooBar);

// There are 2 instances of FooBar, 2 instances of Foo and only 1 instance of Bar

console.log(fooBar1.foo !== fooBar2.foo); // true
console.log(fooBar1.bar === fooBar2.bar); // true




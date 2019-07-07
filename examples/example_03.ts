import {InjectId, Injector} from 'mani-injector';

class Foo {}

class FooBar {
    constructor(
        @InjectId('first') readonly foo1: Foo,
        @InjectId('second') readonly foo2: Foo,
    ) {}
}

const injector = new Injector();

injector.map(Foo, 'first');                 // new instance is created every time Foo is requested with the id 'first'
injector.map(Foo, 'second').toSingleton();  // single instance is returned every time Foo is requested with the id 'second'
injector.map(FooBar);                          // new instance is created every time FooBar is injected / requested

const fooBar1 = injector.get(FooBar);
const fooBar2 = injector.get(FooBar);

// There are 2 instances of FooBar, 2 instances of Foo and only 1 instance of Bar
console.log(fooBar1.foo1 !== fooBar2.foo1); // true
console.log(fooBar1.foo2 === fooBar2.foo2); // true




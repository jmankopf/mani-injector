import {Inject, Injector, InjectType} from 'mani-injector';

class Foo {}
type Bar = { id: number };

class FooBar {
    constructor(
        @Inject readonly foo: Foo,
        @InjectType('bar') readonly bar: Bar,
    ) {}
}

const injector = new Injector();

const fooValue = new Foo();
const barValue = {id: 1};

// every time Foo is requested return the given value 'fooValue'
injector.map(Foo).toValue(fooValue);
// every time the type with id 'bar' is requested return the given value 'barValueÄ
injector.mapType<Bar>('bar').toValue(barValue);
// new instance is created every time FooBar is injected / requested
injector.map(FooBar);

const fooBar1 = injector.get(FooBar);
const fooBar2 = injector.get(FooBar);

// There are 2 instances of FooBar, 2 instances of Foo and only 1 instance of Bar
console.log(fooBar1.foo === fooValue); // true
console.log(fooBar2.foo === fooValue); // true
console.log(fooBar1.bar === barValue); // true
console.log(fooBar2.bar === barValue); // true




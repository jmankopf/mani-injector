# mani-injector

Very fast and lightweight dependency injection for typescript

## Usage
```
$ npm install mani-injector --save
```

#### Injecting classes
```typescript
import {Inject, Injector} from 'mani-injector';

class Foo {}

class Bar {}

class FooBar {
    constructor(
        @Inject readonly foo: Foo,
        @Inject readonly bar: Bar
    ) {}
}

const injector = new Injector();

// new instance is created every time Foo is injected / requested
injector.map(Foo);
// Bar is only created once and that instance is used everywhere
injector.map(Bar).toSingleton();
// new instance is created every time FooBar is injected / requested
injector.map(FooBar);

const fooBar1 = injector.get(FooBar);
const fooBar2 = injector.get(FooBar);

// There are 2 instances of FooBar, 2 instances of Foo and only 1 instance of Bar
console.log(fooBar1.foo !== fooBar2.foo); // true
console.log(fooBar1.bar === fooBar2.bar); // true
```
#### Injecting types
```typescript
import {Injector, InjectType} from 'mani-injector';

interface IFoo {}
interface IBar {}
interface IFooBar {
    readonly foo: IFoo;
    readonly bar: IBar;
}

const barSymbol = Symbol('Bar');

class Foo implements IFoo {}

class Bar implements IBar{}

class FooBar implements IFooBar {
    constructor(
        @InjectType('foo') readonly foo: IFoo,
        @InjectType(barSymbol) readonly bar: IBar
    ) {}
}

const injector = new Injector();

// every time the type with the id 'foo' is requested a new instance of Foo is created
injector.mapType<IFoo>('foo').toClass(Foo);
// every time the type with the symbol 'barSymbol' is requested a single instance of Bar is returned
injector.mapType<IBar>(barSymbol).toSingleton(Bar);
// every time the type with the id 'myFooBar' is requested a new instance of FooBar is created
injector.mapType<IFooBar>('myFooBar').toClass(FooBar); 

const fooBar1 = injector.getType<IFooBar>('myFooBar');
const fooBar2 = injector.getType<IFooBar>('myFooBar');

// There are 2 instances of FooBar, 2 instances of Foo and only 1 instance of Bar

console.log(fooBar1.foo !== fooBar2.foo); // true
console.log(fooBar1.bar === fooBar2.bar); // true
console.log(fooBar1.bar instanceof Bar); // true
console.log(fooBar1.foo instanceof Foo); // true
```

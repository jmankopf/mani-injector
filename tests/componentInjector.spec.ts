import {
    CompTestEntityA,
    CompTestEntityB,
    CompTestEntityC,
    CompTestSystemA,
    CompTestSystemAJustComponent,
    CompTestSystemAJustEntity,
    CompTestSystemAParams,
    CompTestSystemB,
    CompTestSystemC, SystemDependency
} from './testSystem';
import {Injector} from '../src/injector';
import {SimpleA} from './simpleClasses';

type Class<T = any> = { new(...args: any[]): T; }
const containsInstanceOf = (array: unknown[], type: Class) => array.some(element => element instanceof type);
const getFirstInstanceOf = <T extends Class>(array: unknown[], type: T): InstanceType<T> =>
    array.filter(element => element instanceof type)[0] as InstanceType<T>;

describe('ComponentInjector tests', () => {
    it('should register and create systems and inject entities, components and other dependencies', () => {
        const injector = new Injector();
        const entityA = new CompTestEntityA();
        const entityA2 = new CompTestEntityA();
        const entityB = new CompTestEntityB();
        const entityC = new CompTestEntityC();


        injector.registerSystem(CompTestSystemA);
        injector.registerSystem(CompTestSystemB);
        injector.registerSystem(CompTestSystemC);

        // type mapping after system registering to check lazy resolver creation
        injector.map(SystemDependency);
        const params = {param1: 10, param2: 20};
        injector.registerSystem(CompTestSystemAParams, params);

        const systemsForA = injector.createSystems(entityA);
        const systemsForA2 = injector.createSystems(entityA2);
        const systemsForB = injector.createSystems(entityB);
        const systemsForC = injector.createSystems(entityC);

        expect(systemsForA.length).toBe(2);
        expect(containsInstanceOf(systemsForA, CompTestSystemA)).toBeTruthy();
        expect(containsInstanceOf(systemsForA, CompTestSystemAParams)).toBeTruthy();

        expect(systemsForB.length).toBe(3);
        expect(containsInstanceOf(systemsForB, CompTestSystemA)).toBeTruthy();
        expect(containsInstanceOf(systemsForB, CompTestSystemB)).toBeTruthy();
        expect(containsInstanceOf(systemsForB, CompTestSystemAParams)).toBeTruthy();

        expect(systemsForC.length).toBe(0);

        const systemAForA = getFirstInstanceOf(systemsForA, CompTestSystemA);
        const systemAForA2 = getFirstInstanceOf(systemsForA2, CompTestSystemA);

        expect(systemAForA.entity).toBe(entityA);
        expect(systemAForA2.entity).toBe(entityA2);
        expect(systemAForA.componentA).toBe(entityA.compTestA);
        expect(systemAForA.injector).toBe(injector);

        const systemAParamsForA = getFirstInstanceOf(systemsForA, CompTestSystemAParams);
        expect(systemAParamsForA.params).toBe(params);

        const systemAForB = getFirstInstanceOf(systemsForB, CompTestSystemA);
        expect(systemAForB.componentA).toBe(entityB.cTestA);

        const systemBForB = getFirstInstanceOf(systemsForB, CompTestSystemB);
        expect(systemBForB.componentA).toBe(entityB.cTestA);
        expect(systemBForB.componentB).toBe(entityB.compTestB);
    });

    it('should throw invalid dependency errors when using @GetComponent and @GetEntity outside entity scope', () => {
        const injector = new Injector();
        injector.map(CompTestSystemAJustEntity);
        injector.map(CompTestSystemAJustComponent);

        expect(() => injector.get(CompTestSystemAJustEntity)).toThrow('Could not resolve Entity');
        expect(() => injector.get(CompTestSystemAJustComponent)).toThrow('Could not resolve CompTestA');
    });

    it('should dispose injector and delete all properties', () => {
        const injector = new Injector();
        injector.map(SimpleA);
        const childInjector = injector.createChild();
        expect(childInjector.get(SimpleA) instanceof SimpleA).toBeTruthy();

        childInjector.dispose();
        // be sure not to touch parent injector
        expect(injector.get(SimpleA) instanceof SimpleA).toBeTruthy();
        expect(() => childInjector.get(SimpleA)).toThrow();

    });
    // it('speed test system creation', () => {
    //     const injector = new Injector();
    //     const entityA = new CompTestEntityA();
    //     const entityB = new CompTestEntityB();
    //
    //     injector.registerSystem(CompTestSystemA);
    //     injector.registerSystem(CompTestSystemB);
    //
    //     console.time();
    //     for (let i=0; i<10_000_000; i++) {
    //         injector.createSystems(new CompTestEntityB());
    //     }
    //     console.timeEnd();
    //     console.log(injector.COUNT);
    //
    // })
});

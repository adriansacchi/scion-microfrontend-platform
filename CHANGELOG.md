# [1.0.0-beta.9](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/compare/1.0.0-beta.8...1.0.0-beta.9) (2021-01-18)


### Bug Fixes

* **devtools:** perform scope check when computing dependencies between micro applications ([5e43bc3](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/5e43bc3a44c8e7b2056e2d10fa18cbd146c0d895))
* **platform:** resolve host startup promise only once applications and properties are available ([f4067c2](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/f4067c26755f62ccf8daff1abbcb55f34413f5ae))


### Features

* **platform:** allow monitoring `sci-router-outlet` whether embedded content has gained or lost focus ([14fb178](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/14fb17884cc9da4dca481894f3d64f8785f512cc))
* **platform:** allow passing params in an intent ([b82b343](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/b82b34390269992c20ae48d0dc258febbe02c352)), closes [#44](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/issues/44)
* **platform:** open shadow DOM of the router outlet ([cb10c32](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/cb10c32dab7d7e5a4e3d67ba99efb708650020f0))



# [1.0.0-beta.8](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/compare/1.0.0-beta.7...1.0.0-beta.8) (2020-12-18)


### Bug Fixes

* **platform:** allow empty path as url for outlet navigation ([8a0a70b](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/8a0a70b7fbcf432c6928bdc1478aba6685eede4f))
* **platform:** ensure trailing slash in application base URLs ([62a7a92](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/62a7a921a80dd6f340abdafea21342bd135238b0))
* **platform:** make platform startup more robust ([0d30b72](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/0d30b726c776dcb56afd0a34454453325a4208ea)), closes [#40](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/issues/40) [#41](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/issues/41)


### Features

* **devtools:** add devtools micro application ([19db8bf](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/19db8bf646b3a46667cd82a513f109c3297f5068)), closes [#4](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/issues/4)
* **platform:** provide a static list of installed applications in the manifest service ([b60015f](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/b60015f798a6ce8e5ed765f942536a89df922407))


### BREAKING CHANGES

* **platform:** The `HostPlatformState` bean has been removed as no longer necessary, because activator microfrontends are now installed after completing host platform startup, and because the startup Promise waits until connected to the host.

To migrate: Instead of listening for the host platform to enter the 'started' state, wait for the startup Promise to resolve.
Note: You can independently upgrade host and clients to the new version because the platform was not using the platform status at all.



# [1.0.0-beta.7](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/compare/1.0.0-beta.6...1.0.0-beta.7) (2020-11-05)


### Code Refactoring

* **platform:** move bean manager to @scion/toolkit ([aa00b7e](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/aa00b7e07e4a5f976c7e99cc96c95430bec5574d)), closes [#33](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/issues/33)


### BREAKING CHANGES

* **platform:** The bean manager was moved from `@scion/microfrontend-platform` to `@scion/toolkit` NPM module.

> Note: The messaging protocol between host and client HAS NOT CHANGED. You can therefore independently upgrade host and clients to the new version.

To migrate:
-  Update `@scion/toolkit` to version `10.0.0-beta.3`.
- Import following symbols from `@scion/toolkit/bean-manager` instead of from `@scion/microfrontend-platform`: `BeanManager`, `Beans`, `Initializer`, `InitializerFn`, `BeanDecorator`, `PreDestroy`, `BeanInstanceConstructInstructions`, `Type`, `AbstractType`.
- Replace `InstanceConstructInstructions` with `BeanInstanceConstructInstructions`.
- Use static methods of the `MicrofrontendPlatform` class to interact with states of the platform lifecycle (formerly via `PlatformState` bean), e.g., to wait for the platform to enter a specific state. In this change, we changed the bean `PlatformState` to an `enum` to represent platform states (formerly `PlatformStates`).
Migrate as follows:
  - _Beans.get(PlatformState).whenState_ -> _MicrofrontendPlatform.whenState_, e.g., `Beans.get(PlatformState).whenState(PlatformStates.Starting) -> MicrofrontendPlatform.whenState(PlatformStates.Starting)`
  - _Beans.get(PlatformState).state_ -> _MicrofrontendPlatform.state_
  - _Beans.get(PlatformState).state$_ -> _MicrofrontendPlatform.state$_
- Replace occurrences of `PlatformStates` with `PlatformState`.
- Control bean destruction order by setting its `destroyOrder` in the options object when registering the  bean (formerly by setting the destroy phase). Beans with a lower destroy order are destroyed before beans with a higher destroy order. Beans of the same destroy order are destroyed in reverse construction order. By default, the destroy order is 0.
- Registering a bean now returns a handle to unregister the bean (formerly `void`). If registering a bean inside a `void` expression, register it inside a void operator, as follows: `void (Beans.register(Bean))`



# [1.0.0-beta.6](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/compare/1.0.0-beta.5...1.0.0-beta.6) (2020-09-30)


### Bug Fixes

* **platform:** substitute falsy values in named parameters of URL ([96c84db](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/96c84db683a8949176c59caa03d414850a0cea05)), closes [#24](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/issues/24)


### Features

* **platform:** allow registering beans under a symbol ([98bf890](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/98bf8902762c720a36ae6b481558e488e04bad58)), closes [#28](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/issues/28)
* **platform:** separate message and intent communication APIs ([7610eb0](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/7610eb00b4750447ad85b00e3acd470cf1950998))


### BREAKING CHANGES

* **platform:** Use `MessageClient` for topic-based messaging, and `IntentClient` for intent-based messaging

Note: The messaging protocol between host and client HAS NOT CHANGED. You can therefore independently upgrade host and clients to the new version.

#### Breaking changes in MessageClient
Moved or renamed the following methods:
- _MessageClient#onMessage$_ -> _MessageClient.observe$_
- _MessageClient#issueIntent_ -> _IntentClient.publish_
- _MessageClient#requestByIntent$_ -> _IntentClient.request$_
- _MessageClient#onIntent$_ -> _IntentClient.observe$_
- _MessageClient#isConnected_ -> _MicrofrontendPlatform.isConnectedToHost_

Renamed options object of the following methods:
- _MessageClient#request$_: _MessageOptions_ -> _RequestOptions_
- _IntentClient#publish_: _MessageOptions_ -> _IntentOptions_
- _IntentClient#request$_: _MessageOptions_ -> _IntentOptions_

#### Breaking change for decorating MessageClient and IntentClient bean
For Angular developers, see [Preparing the MessageClient and IntentClient for use with Angular](https://scion-microfrontend-platform-developer-guide.now.sh/#chapter:angular-integration-guide:preparing-messaging-for-use-with-angular) how to decorate the `MessageClient` and `IntentClient` for making Observables to emit inside the Angular zone.

#### Breaking change for disabling messaging in tests
Messaging can now be deactivated via options object when starting the platform. Previously you had to register a `NullMessageClient` bean.
```MicrofrontendPlatform.connectToHost({messaging: {enabled: false}}```



# [1.0.0-beta.5](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/compare/1.0.0-beta.4...1.0.0-beta.5) (2020-07-17)


### chore

* update project workspace to Angular 10 ([20a3266](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/20a3266823ce1a3f82063e87e18235988a6ed478)), closes [#19](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/issues/19)


### BREAKING CHANGES

* esm5 and fesm5 format is no longer distributed in `@scion/microfrontend-platform`’s NPM package

We no longer include the distributions for `esm5` and `fesm5` in the `@scion/microfrontend-platform`’s NPM package. Only the formats for `esm2015`, `fesm2015`, and UMD are distributed. Consequently, the module field in package.json now points to the `fesm2015` distribution.

To migrate:
- If requiring `esm5` or `fesm5`, you will need to downlevel to ES5 yourself. If using Angular, the Angular CLI will automatically downlevel the code to ES5 if differential loading is enabled in the Angular project, so no action is required from Angular CLI users.



# [1.0.0-beta.4](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/compare/1.0.0-beta.3...1.0.0-beta.4) (2020-07-14)


### Bug Fixes

* **testapp:** do not render the application shell in activator microfrontends ([2180257](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/2180257deecfe4bbf67862049ecc1e3e5e443151))


### Features

* **platform:** enable activators to signal their readiness ([5beb278](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/5beb278b26e1850fa21e0dbf05677e635a63c4e4)), closes [#6](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/issues/6)



# [1.0.0-beta.3](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/compare/1.0.0-beta.2...1.0.0-beta.3) (2020-06-30)



# [1.0.0-beta.2](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/compare/1.0.0-beta.1...1.0.0-beta.2) (2020-06-29)



# 1.0.0-beta.1 (2020-06-21)


### Features

* **platform:** move SCION Microfrontend Platform to a separate Git repository ([b191ccd](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/b191ccdfa4d1c65f6c5086a0fea6702a887c525d))
* **platform:** provide services to manage and query capabilities and intentions ([3923331](https://github.com/SchweizerischeBundesbahnen/scion-microfrontend-platform/commit/39233310db259a488de8cd90f4248cdda6c401f1))




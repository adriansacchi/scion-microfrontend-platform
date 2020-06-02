/*
 * Copyright (c) 2018-2020 Swiss Federal Railways
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 *  SPDX-License-Identifier: EPL-2.0
 */

import { AbstractType, BeanInfo, Beans, Type } from './bean-manager';
import { MicrofrontendPlatform } from './microfrontend-platform';
import { MessageClient, NullMessageClient } from './client/messaging/message-client';
import { PlatformState, PlatformStates } from './platform-state';
import { ApplicationConfig } from './host/platform-config';
import { HostPlatformState } from './client/host-platform-state';
import { serveManifest } from './spec.util.spec';
import { PlatformMessageClient } from './host/platform-message-client';

describe('MicrofrontendPlatform', () => {

  beforeEach(async () => await MicrofrontendPlatform.destroy());
  afterEach(async () => await MicrofrontendPlatform.destroy());

  it('should report that the app is not connected to the platform host when the host platform is not found', async () => {
    await MicrofrontendPlatform.connectToHost({symbolicName: 'client-app', messaging: {brokerDiscoverTimeout: 250}});
    await expect(await MicrofrontendPlatform.isConnectedToHost()).toBe(false);
  });

  it('should report that the app is not connected to the platform host when the client platform is not started', async () => {
    await expect(await MicrofrontendPlatform.isConnectedToHost()).toBe(false);
  });

  it('should report that the app is connected to the platform host when connected', async () => {
    const manifestUrl = serveManifest({name: 'Host Application'});
    const registeredApps: ApplicationConfig[] = [{symbolicName: 'host-app', manifestUrl: manifestUrl}];
    await MicrofrontendPlatform.startHost(registeredApps, {symbolicName: 'host-app', messaging: {brokerDiscoverTimeout: 250}});
    await expect(await MicrofrontendPlatform.isConnectedToHost()).toBe(true);
  });

  it('should enter state \'started\' when started', async () => {
    Beans.register(MessageClient, {useClass: NullMessageClient});
    await expectAsync(MicrofrontendPlatform.connectToHost({symbolicName: 'A'})).toBeResolved();
    expect(Beans.get(PlatformState).state).toEqual(PlatformStates.Started);
  });

  it('should reject starting the client platform multiple times', async () => {
    Beans.register(MessageClient, {useClass: NullMessageClient});
    await expectAsync(MicrofrontendPlatform.connectToHost({symbolicName: 'A'})).toBeResolved();

    try {
      await MicrofrontendPlatform.connectToHost({symbolicName: 'A'});
      fail('expected \'MicrofrontendPlatform.forClient()\' to error');
    }
    catch (error) {
      await expect(error.message).toMatch(/\[PlatformStateError] Failed to enter platform state \[prevState=Started, newState=Starting]/);
    }
  });

  it('should reject starting the host platform multiple times', async () => {
    await expectAsync(MicrofrontendPlatform.startHost([])).toBeResolved();

    try {
      await MicrofrontendPlatform.startHost([]);
      fail('expected \'MicrofrontendPlatform.startHost()\' to error');
    }
    catch (error) {
      await expect(error.message).toMatch(/\[PlatformStateError] Failed to enter platform state \[prevState=Started, newState=Starting]/);
    }
  });

  it('should allow clients to wait until the host platform started', async () => {
    const manifestUrl = serveManifest({name: 'Host Application'});
    const registeredApps: ApplicationConfig[] = [{symbolicName: 'host-app', manifestUrl: manifestUrl}];
    await MicrofrontendPlatform.startHost(registeredApps, {symbolicName: 'host-app', messaging: {brokerDiscoverTimeout: 250, deliveryTimeout: 250}});

    await expectAsync(Beans.get(HostPlatformState).whenStarted()).toBeResolved();
  });

  it('should register the `MessageClient` as alias for `PlatformMessageClient` when starting the host platform without app', async () => {
    await MicrofrontendPlatform.startHost([]);

    expect(getBeanInfo(MessageClient)).toEqual(jasmine.objectContaining({useExisting: PlatformMessageClient}));
    expect(Beans.get(MessageClient)).toBe(Beans.get(PlatformMessageClient));
  });

  it('should not register the `MessageClient` as alias for `PlatformMessageClient` when starting the host platform with an app', async () => {
    const manifestUrl = serveManifest({name: 'Host Application'});
    const registeredApps: ApplicationConfig[] = [{symbolicName: 'host-app', manifestUrl: manifestUrl}];
    await MicrofrontendPlatform.startHost(registeredApps, {symbolicName: 'host-app', messaging: {brokerDiscoverTimeout: 250, deliveryTimeout: 250}});

    expect(getBeanInfo(MessageClient)).toEqual(jasmine.objectContaining({eager: true, destroyPhase: PlatformStates.Stopped}));
    expect(getBeanInfo(PlatformMessageClient)).toEqual(jasmine.objectContaining({eager: true, destroyPhase: PlatformStates.Stopped}));
    expect(Beans.get(MessageClient)).not.toBe(Beans.get(PlatformMessageClient));
  });
});

function getBeanInfo<T>(symbol: Type<T | any> | AbstractType<T | any>): BeanInfo<T> {
  return Array.from(Beans.getBeanInfo<T>(symbol) || new Set<BeanInfo<T>>())[0];
}

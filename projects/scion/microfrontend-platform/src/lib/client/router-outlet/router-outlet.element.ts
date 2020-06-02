/*
 * Copyright (c) 2018-2020 Swiss Federal Railways
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 *  SPDX-License-Identifier: EPL-2.0
 */
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { RouterOutletContextProvider } from '../context/router-outlet-context-provider';
import { runSafe } from '../../safe-runner';
import { distinctUntilChanged, map, pairwise, startWith, switchMap, takeUntil, tap } from 'rxjs/operators';
import { RouterOutletUrlAssigner } from './router-outlet-url-assigner';
import { Beans } from '../../bean-manager';
import { mapToBody, MessageClient } from '../messaging/message-client';
import { Defined } from '@scion/toolkit/util';
import { UUID } from '@scion/toolkit/uuid';
import { TopicMessage } from '../../messaging.model';
import { Keystroke } from '../keyboard-event/keystroke';
import { PreferredSize } from '../preferred-size/preferred-size';
import { Navigation, PUSH_STATE_TO_SESSION_HISTORY_STACK_MESSAGE_HEADER } from './metadata';

/** @ignore */
const ELEMENT_NAME = 'sci-router-outlet';
/** @ignore */
const ATTR_NAME = 'name';
/** @ignore */
const ATTR_SCROLLABLE = 'scrollable';
/** @ignore */
const ATTR_KEYSTROKES = 'keystrokes';
/** @ignore */
const HTML_TEMPLATE = `
  <style>
    :host {
      display: block;
      overflow: hidden;
    }

    iframe {
      width: 100%;
      height: 100%;
      border: none;
      margin: 0;
    }
  </style>
  <iframe src="about:blank" scrolling="yes" marginheight="0" marginwidth="0"></iframe>
`;

/**
 * Web component that allows embedding web content using the {@link OutletRouter}. The content is displayed inside
 * an iframe to achieve the highest possible level of isolation between the microfrontends via a separate browsing context.
 *
 * To embed a microfrontend, place this custom HMTL element `<sci-router-outlet></sci-router-outlet>` in an HTML
 * template, give it a name via its `name` attribute and navigate via {@link OutletRouter} to instruct the outlet to
 * load the microfrontend.
 *
 * 1. Place the web component in an HTML template:
 * ```html
 * <sci-router-outlet name="detail"></sci-router-outlet>
 * ```
 *
 * 2. Control the outlet's content:
 * ```ts
 * Beans.get(OutletRouter).navigate('https://micro-frontends.org', {outlet: 'detail'});
 * ```
 *
 * Outlets can be nested, allowing a microfrontend to embed another microfrontend. There is no limit to the number of
 * nested outlets. However, be aware that nested content is loaded cascaded, that is, only loaded once its parent content
 * finished loading.
 *
 * When adding the outlet to the DOM, the outlet displays the last URL routed for it, if any. When repeating routing for
 * an outlet, its content is replaced.
 *
 * ***
 *
 * #### Outlet Context
 * The router outlet allows associating contextual data, which then is available to embedded content at any nesting level.
 * Data must be serializable with the structured clone algorithm. Embedded content can look up contextual data using the
 * {@link ContextService}. Typically, contextual data is  used to provide microfrontends with information about their embedding
 * environment. Looking up contextual data requires the embedded microfrontend to be a registered micro application.
 *
 * Each outlet spans a new context. A context is like a `Map` with key-value entries. Contexts form a hierarchical tree structure.
 * When looking up a value and if the value is not found in the current context, the lookup is retried on the parent context,
 * repeating until either a value is found, or the root of the context tree has been reached.
 *
 * You can set contextual data as following:
 * ```ts
 *  const outlet: SciRouterOutletElement = document.querySelector('sci-router-outlet');
 *  outlet.setContextValue('key', 'value');
 * ```
 *
 * Embedded content can look up contextual data as following:
 * ```ts
 * Beans.get(ContextService).observe$('key').subscribe(value => {
 *   ...
 * });
 * ```
 *
 * #### Outlet size
 * The router outlet can adapt its size to the preferred size of its embedded content. The preferred size is set by the microfrontend
 * embedded in the router outlet. Setting the outlet size requires the embedded microfrontend to be a registered micro application.
 *
 * Embedded content can report its preferred size using the {@link PreferredSizeService}, causing the outlet to change its size,
 * as following:
 *
 * ```ts
 * Beans.get(PreferredSizeService).setPreferredSize({width: '100%', minHeight: '400px'});
 * ```
 *
 * The platform provides a convenience API to bind a DOM element via {@link PreferredSizeService.fromDimension} to automatically report
 * its content size as preferred size to the outlet. The element to be observed must behave as a `block-level` box and not as an `inline-level`
 * box. So, if you want to observe an inline element, you have to override its display type to either `block` or `inline-block`.
 *
 * ```ts
 * const mainElement = document.querySelector('main');
 *
 * // Bind the element to automatically report its size.
 * Beans.get(PreferredSizeService).fromDimension(mainElement);
 * ```
 *
 * #### Keystroke Bubbling
 * The router outlet allows the registration of keystrokes, instructing embedded content at any nesting level to propagate corresponding keyboard events
 * to this outlet. The outlet dispatches keyboard events for registered keystrokes as synthetic keyboard events via its event dispatcher. They bubble up
 * the DOM tree like regular events. Propagated events are of the original type, meaning that when the user presses a key on the keyboard, a `keydown`
 * keyboard event is dispatched, or a `keyup` event when releasing a key, respectively. Keystroke bubbling requires the embedded microfrontend to be a
 * registered micro application.
 *
 * A keystroke is a `string` that has several parts, each separated with a dot. The first part specifies the event type (`keydown` or `keyup`), followed
 * by optional modifier part(s) (`alt`, `shift`, `control`, `meta`, or a combination thereof) and with the keyboard key as the last part. The key is a
 * case-insensitive value of the `KeyboardEvent.key` property. Two keys are an exception to the value of the `KeyboardEvent.key` property: `dot` and `space`.
 * For a complete list of valid key values, see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values.
 *
 * You can register keystrokes via the `keystrokes` attribute in the HTML template, or via the `keystrokes` property on the DOM
 * element. If setting keystrokes via the HTML template, multiple keystrokes are separated by a comma.
 *
 * HTML template:
 * ```html
 * <sci-router-outlet keystrokes="keydown.control.alt.enter,keydown.escape,keydown.control.space"></sci-router-outlet>
 * ```
 *
 * Alternatively, you can register keystrokes on the DOM element as shown below.
 *
 * TypeScript:
 * ```ts
 *  const outlet: SciRouterOutletElement = document.querySelector('sci-router-outlet');
 *  outlet.keystrokes = [
 *      'keydown.control.alt.enter',
 *      'keydown.escape',
 *      'keydown.control.space'
 *  ];
 * ```
 *
 * #### Scrollable Content
 * By default, page scrolling is enabled for the embedded content, displaying a scrollbar when it overflows. If disabled, overflowing content is clipped,
 * unless the embedded content uses a viewport, or reports its preferred size to the outlet.
 *
 * The below code snippet illustrates how to disable page scrolling for the embedded content.
 * ```html
 * <sci-router-outlet scrollable="false"></sci-router-outlet>
 * ```
 *
 * #### Router Outlet Events
 * The router outlet emits an `activate` event when a microfrontend is mounted, and a `deactivate` event when a microfrontend is unmounted.
 * The events are emitted as a custom DOM event and contain the URL of the mounted or unmounted microfrontend. You can attach an event listener
 * declaratively in the HTML template using the `onevent` handler syntax, or programmatically using the `addEventListener` method.
 *
 * ```html
 * <sci-router-outlet onactivate="onActivate()"></sci-router-outlet>
 * ````
 *
 * #### Web component
 * The outlet is registered as a custom element in the browser's custom element registry as defined by the Web Components standard.
 * See https://developer.mozilla.org/en-US/docs/Web/Web_Components for more information.
 *
 * #### Miscellaneous
 * If no content is routed for display in the router outlet, the CSS class `sci-empty` is added to the outlet. An outlet will not display content if
 * either there has not yet been any navigation for the outlet or the outlet content has been cleared.
 *
 * @see {@link OutletRouter}
 * @see {@link PreferredSizeService}
 * @see {@link ContextService}
 *
 * @category Routing
 */
export class SciRouterOutletElement extends HTMLElement {

  private _shadowRoot: ShadowRoot;
  private _disconnect$ = new Subject<void>();

  private _uid = UUID.randomUUID();
  private _iframe: HTMLIFrameElement;
  private _outletName$: BehaviorSubject<string>;
  private _contextProvider: RouterOutletContextProvider;
  private _empty$ = new BehaviorSubject<boolean>(true);

  /**
   * Emits whether or not content is routed for display in this router outlet.
   * Upon subscription, the Observable emits the current empty state, and then continuously emits when it changes. It never completes.
   *
   * An outlet does not display content if no navigation has taken place yet, or if the outlet content has been cleared.
   */
  public readonly empty$: Observable<boolean>;

  constructor() {
    super();
    this._outletName$ = new BehaviorSubject<string>(PRIMARY_OUTLET);
    this._shadowRoot = this.attachShadow({mode: 'closed'});
    this._shadowRoot.innerHTML = HTML_TEMPLATE.trim();
    this._iframe = this._shadowRoot.querySelector('iframe');
    this._contextProvider = new RouterOutletContextProvider(this._iframe);
    this.empty$ = this._empty$.pipe(distinctUntilChanged());
  }

  /**
   * Sets the name of this outlet.
   *
   * By giving the outlet a name, you can reference the outlet when navigating. The name is optional;
   * if not set, it defaults to {@link PRIMARY_OUTLET primary}
   */
  public set name(name: string) {
    if (name) {
      this.setAttribute(ATTR_NAME, name);
    }
    else {
      this.removeAttribute(ATTR_NAME);
    }
  }

  /**
   * Returns the name of this outlet.
   */
  public get name(): string {
    return this.getAttribute(ATTR_NAME);
  }

  /**
   * Specifies whether to enable or disable native page scrolling in the embedded document.
   *
   * By default, page scrolling is enabled for the embedded content, displaying a scrollbar when it overflows.
   * If disabled, overflowing content is clipped, unless the embedded content uses a viewport, or reports
   * its preferred size to the outlet.
   */
  public set scrollable(scrollable: boolean) {
    if (scrollable) {
      this.setAttribute(ATTR_SCROLLABLE, 'true');
    }
    else {
      this.removeAttribute(ATTR_SCROLLABLE);
    }
  }

  /**
   * Returns whether the embedded document is natively page scrollable.
   */
  public get scrollable(): boolean {
    return this.getAttribute(ATTR_SCROLLABLE) === 'true';
  }

  /**
   * Instructs embedded content at any nesting level to propagate keyboard events to this outlet. The outlet dispatches keyboard events for registered
   * keystrokes as synthetic keyboard events via its event dispatcher. They bubble up the DOM tree like regular events. Propagated events are of the
   * original type, meaning that when the user presses a key on the keyboard, a `keydown` keyboard event is dispatched, or a `keyup` event when releasing
   * a key, respectively.
   *
   * @param keystrokes - A keystroke is specified as a string that has several parts, each separated with a dot. The first part specifies the event type
   *                   (`keydown` or `keyup`), followed by optional modifier part(s) (`alt`, `shift`, `control`, `meta`, or a combination thereof) and
   *                   with the keyboard key as the last part. The key is a case-insensitive value of the `KeyboardEvent#key` property. For a complete
   *                   list of valid key values, see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values. Two keys are an
   *                   exception to the value of the `KeyboardEvent#key` property: `dot` and `space`.
   *                   <br>
   *                   Examples: `keydown.control.z`, `keydown.escape`, `keyup.enter`, `keydown.control.alt.enter`, `keydown.control.space`.
   */
  public set keystrokes(keystrokes: string[]) {
    if (keystrokes && keystrokes.length) {
      this.setAttribute(ATTR_KEYSTROKES, KeystrokesAttributeUtil.join(keystrokes));
    }
    else {
      this.removeAttribute(ATTR_KEYSTROKES);
    }
  }

  /**
   * Returns the keystrokes which to bubble across the iframe boundaries.
   */
  public get keystrokes(): string[] {
    return KeystrokesAttributeUtil.split(this.getAttribute(ATTR_KEYSTROKES));
  }

  /**
   * Makes contextual data available to embedded content. Embedded content can lookup contextual data using the {@link ContextService}.
   * Contextual data must be serializable with the structured clone algorithm.
   */
  public setContextValue<T = any>(name: string, value: T): void {
    this._contextProvider.set(name, value);
  }

  /**
   * Removes data registered under the given key from the context.
   *
   * Removal does not affect parent contexts, so it is possible that a subsequent call to {@link ContextService.observe$} with the same name
   * will return a non-null result, due to a value being stored in a parent context.
   *
   * @return `true` if removed the value from the outlet context; otherwise `false`.
   */
  public removeContextValue(name: string): boolean {
    return this._contextProvider.remove(name);
  }

  /**
   * Returns an Observable that emits the context of this outlet. Context values inherited from parent contexts are not returned.
   * The Observable never completes, and emits when a context value is added to or removed from the outlet context.
   */
  public get contextValues$(): Observable<Map<string, any>> {
    return this._contextProvider.entries$;
  }

  /**
   * Resets the preferred size which may have been set by the embedded content.
   */
  public resetPreferredSize(): void {
    Beans.get(MessageClient).publish(RouterOutlets.preferredSizeTopic(this._uid), null);
  }

  /**
   * Returns the preferred size, if any, or `undefined` otherwise.
   */
  public get preferredSize(): PreferredSize | undefined {
    const preferredSize: PreferredSize = {
      minWidth: this.style.minWidth || undefined,
      width: this.style.width || undefined,
      maxWidth: this.style.maxWidth || undefined,
      minHeight: this.style.minHeight || undefined,
      height: this.style.height || undefined,
      maxHeight: this.style.maxHeight || undefined,
    };
    if (Object.values(preferredSize).some(Boolean)) {
      return preferredSize;
    }
    return undefined;
  }

  /**
   * Returns the reference to the iframe of this outlet.
   */
  public get iframe(): HTMLIFrameElement {
    return this._iframe;
  }

  private installOutletContext(): void {
    this._outletName$
      .pipe(takeUntil(this._disconnect$))
      .subscribe((name: string) => {
        const outletContext: OutletContext = {name: name, uid: this._uid};
        this.setContextValue(OUTLET_CONTEXT, outletContext);
      });
  }

  private installOutletUrlListener(): void {
    this._outletName$
      .pipe(
        switchMap(outlet => outletNavigate$(outlet).pipe(startWith(null as Navigation))), // start with a `null` navigation in case no navigation took place yet
        tap(navigation => this._empty$.next(!navigation || navigation.url === 'about:blank')),
        distinctUntilChanged(null, navigation => navigation && navigation.url),
        pairwise(),
        takeUntil(this._disconnect$),
      )
      .subscribe(([prevNavigation, currNavigation]: [Navigation, Navigation]) => runSafe(() => {
        // Emit a page deactivate event, unless not having a previous navigation
        prevNavigation && this.dispatchEvent(new CustomEvent('deactivate', {detail: prevNavigation.url}));
        // Change the outlet URL
        Beans.get(RouterOutletUrlAssigner).assign(this._iframe, currNavigation || {url: 'about:blank', pushStateToSessionHistoryStack: false}, prevNavigation);
        // Emit a page activate event, unless not having a current navigation
        currNavigation && this.dispatchEvent(new CustomEvent('activate', {detail: currNavigation.url}));
      }));
  }

  private installPreferredSizeListener(): void {
    Beans.get(MessageClient).onMessage$<PreferredSize>(RouterOutlets.preferredSizeTopic(this._uid))
      .pipe(
        takeUntil(this._disconnect$),
        mapToBody(),
      )
      .subscribe((preferredSize: PreferredSize) => {
        this.style.minWidth = preferredSize && preferredSize.minWidth || null;
        this.style.width = preferredSize && preferredSize.width || null;
        this.style.maxWidth = preferredSize && preferredSize.maxWidth || null;
        this.style.minHeight = preferredSize && preferredSize.minHeight || null;
        this.style.height = preferredSize && preferredSize.height || null;
        this.style.maxHeight = preferredSize && preferredSize.maxHeight || null;
      });
  }

  private installKeyboardEventDispatcher(): void {
    Beans.get(MessageClient).onMessage$<KeyboardEventInit>(RouterOutlets.keyboardEventTopic(this._uid, ':eventType'))
      .pipe(takeUntil(this._disconnect$))
      .subscribe((event: TopicMessage<KeyboardEventInit>) => {
        const type = event.params.get('eventType');
        this.dispatchEvent(new KeyboardEvent(type, event.body));
      });
  }

  private installHostElementDecorator(): void {
    this._empty$
      .pipe(takeUntil(this._disconnect$))
      .subscribe((empty: boolean) => {
        if (empty) {
          this._shadowRoot.host.classList.add('sci-empty');
        }
        else {
          this._shadowRoot.host.classList.remove('sci-empty');
        }
      });
  }

  /**
   * Lifecycle callback of the 'Custom element' Web Component standard.
   *
   * Invoked each time the custom element is appended into a document-connected element.
   * This will happen each time the node is moved, and may happen before the element's contents have been fully parsed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#Using_the_lifecycle_callbacks
   * @internal
   */
  public connectedCallback(): void {
    this.installOutletUrlListener();
    this.installOutletContext();
    this.installPreferredSizeListener();
    this.installKeyboardEventDispatcher();
    this.installHostElementDecorator();
    this._contextProvider.onOutletMount();
  }

  /**
   * Lifecycle callback of the 'Custom element' Web Component standard.
   *
   * Invoked each time the custom element is disconnected from the document's DOM.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#Using_the_lifecycle_callbacks
   * @internal
   */
  public disconnectedCallback(): void {
    this._disconnect$.next();
    this._contextProvider.onOutletUnmount();
  }

  /**
   * Lifecycle callback of the 'Custom element' Web Component standard.
   *
   * Specifies the attributes which to observe in {@link attributeChangedCallback} method.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#Using_the_lifecycle_callbacks
   * @internal
   */
  public static observedAttributes = [ATTR_NAME, ATTR_SCROLLABLE, ATTR_KEYSTROKES]; // tslint:disable-line:member-ordering

  /**
   * Lifecycle callback of the 'Custom element' Web Component standard.
   *
   * Invoked each time one of the custom element's attributes is added, removed, or changed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#Using_the_lifecycle_callbacks
   * @internal
   */
  public attributeChangedCallback(name: string, oldValue: string, newValue: string): void {
    switch (name) {
      case ATTR_NAME: {
        this._outletName$.next(newValue || PRIMARY_OUTLET);
        break;
      }
      case ATTR_SCROLLABLE: {
        this._iframe.setAttribute('scrolling', coerceBooleanProperty(newValue) ? 'yes' : 'no');
        break;
      }
      case ATTR_KEYSTROKES: {
        KeystrokesAttributeUtil.split(oldValue).forEach(keystroke => this.removeContextValue(KEYSTROKE_CONTEXT_NAME_PREFIX + Keystroke.fromString(keystroke).parts));
        KeystrokesAttributeUtil.split(newValue).forEach(keystroke => this.setContextValue(KEYSTROKE_CONTEXT_NAME_PREFIX + Keystroke.fromString(keystroke).parts, undefined));
        break;
      }
    }
  }

  /**
   * Defines this outlet as custom element in the browser custom element registry; has no effect if the element was already defined.
   *
   * @return A Promise that resolves once this custom element is defined.
   * @internal
   */
  public static define(): Promise<void> {
    if (customElements.get(ELEMENT_NAME)) {
      return Promise.resolve();
    }
    else {
      customElements.define(ELEMENT_NAME, SciRouterOutletElement);
      return customElements.whenDefined(ELEMENT_NAME);
    }
  }
}

/**
 * Information about the outlet which embeds a microfrontend.
 *
 * This object can be obtained from the {@link ContextService} using the name {@link OUTLET_CONTEXT}.
 *
 * ```ts
 * Beans.get(ContextService).observe$(OUTLET_CONTEXT).subscribe((outletContext: OutletContext) => {
 *   ...
 * });
 * ```
 *
 * @see {@link OUTLET_CONTEXT}
 * @see {@link ContextService}
 * @category Routing
 */
export interface OutletContext {
  name: string;
  uid: string;
}

/**
 * Coerces a data-bound value (typically a string) to a boolean.
 *
 * @ignore
 */
function coerceBooleanProperty(value: any): boolean {
  return value != null && `${value}` !== 'false';
}

/**
 * Key for obtaining the current outlet context using {@link ContextService}.
 *
 * @see {@link OutletContext}
 * @see {@link ContextService}
 */
export const OUTLET_CONTEXT = 'ɵOUTLET';

/**
 * Default name for an outlet if no explicit name is specified.
 */
export const PRIMARY_OUTLET = 'primary';

/**
 * Defines constants for {@link SciRouterOutletElement} and {@link OutletRouter}.
 *
 * @category Routing
 */
export namespace RouterOutlets {

  /**
   * Computes the topic via which the URL for an outlet is exchanged as retained message.
   *
   * @internal
   */
  export function urlTopic(outletName: string): string {
    return `sci-router-outlets/${outletName}/url`;
  }

  /**
   * Computes the topic where to post keyboard events to be dispatched.
   *
   * @internal
   */
  export function keyboardEventTopic(outletUid: string, eventType: string): string {
    return `sci-router-outlets/${outletUid}/keyboard-events/${eventType}`;
  }

  /**
   * Computes the topic to which the preferred outlet size can be published to.
   *
   * @internal
   */
  export function preferredSizeTopic(outletUid: string): string {
    return `sci-router-outlets/${outletUid}/preferred-size`;
  }
}

/**
 * @ignore
 */
namespace KeystrokesAttributeUtil {

  const delimiter = ',';

  export function split(attributeValue: string | null): string[] {
    return attributeValue ? attributeValue.split(delimiter) : [];
  }

  export function join(keystrokes: string[] | null): string | null {
    return keystrokes ? keystrokes.join(delimiter) : null;
  }
}

/**
 * Keystroke bindings are prefixed with `keystroke:` when registered in the outlet context.
 * @internal
 */
export const KEYSTROKE_CONTEXT_NAME_PREFIX = 'keystroke:';

/**
 * Emits when a navigation for the given outlet occurs.
 * @ignore
 */
function outletNavigate$(outlet: string): Observable<Navigation> {
  const outletNavigationTopic = RouterOutlets.urlTopic(outlet);
  return Beans.get(MessageClient).onMessage$<string>(outletNavigationTopic)
    .pipe(map((navigateMessage: TopicMessage<string>): Navigation => {
      return {
        url: navigateMessage.body || 'about:blank',
        pushStateToSessionHistoryStack: Defined.orElse(navigateMessage.headers.get(PUSH_STATE_TO_SESSION_HISTORY_STACK_MESSAGE_HEADER), false),
      };
    }));
}

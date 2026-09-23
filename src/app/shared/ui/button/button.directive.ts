import {Directive, booleanAttribute, input} from '@angular/core';

export type ButtonVariant = 'filled' | 'tonal' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

/**
 * Styles a native `<button>` or `<a>`. Styles live in `src/styles/_controls.scss` because a
 * directive has no view encapsulation of its own.
 */
@Directive({
  selector: 'button[appButton], a[appButton]',
  host: {
    class: 'app-button',
    '[class.app-button--filled]': "appButton() === 'filled'",
    '[class.app-button--tonal]': "appButton() === 'tonal'",
    '[class.app-button--outline]': "appButton() === 'outline'",
    '[class.app-button--ghost]': "appButton() === 'ghost'",
    '[class.app-button--danger]': "appButton() === 'danger'",
    '[class.app-button--sm]': "size() === 'sm'",
    '[class.app-button--icon]': 'iconOnly()',
  },
})
export class ButtonDirective {
  readonly appButton = input<ButtonVariant>('filled');
  readonly size = input<ButtonSize>('md');
  readonly iconOnly = input(false, {transform: booleanAttribute});
}

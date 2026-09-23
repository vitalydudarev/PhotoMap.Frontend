import {ChangeDetectionStrategy, Component, booleanAttribute, input} from '@angular/core';

/** A surface panel. Optionally renders a header row from `heading` / `description`. */
@Component({
  selector: 'app-card',
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.app-card--flush]': 'flush()',
  },
})
export class CardComponent {
  readonly heading = input<string>();
  readonly description = input<string>();

  /** Drops the body padding, for cards that wrap a full-bleed table. */
  readonly flush = input(false, {transform: booleanAttribute});
}

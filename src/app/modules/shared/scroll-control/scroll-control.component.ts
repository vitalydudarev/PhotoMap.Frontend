import {DOCUMENT} from '@angular/common';
import {ChangeDetectionStrategy, Component, OnInit, inject, signal} from '@angular/core';

import {ButtonDirective} from '../../../shared/ui/button/button.directive';
import {IconComponent} from '../../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-scroll-control',
  templateUrl: './scroll-control.component.html',
  styleUrls: ['./scroll-control.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, IconComponent],
  host: {
    '(window:scroll)': 'onWindowScroll()',
  },
})
export class ScrollControlComponent implements OnInit {
  readonly canScrollUp = signal(false);
  readonly canScrollDown = signal(false);

  private readonly document = inject(DOCUMENT);

  ngOnInit() {
    this.updateScrollState();
  }

  onWindowScroll() {
    this.updateScrollState();
  }

  scrollTo(position: 'top' | 'bottom'): void {
    const documentElement = this.document.documentElement;
    const top = position === 'top' ? 0 : documentElement.scrollHeight;

    this.document.defaultView?.scrollTo({top, behavior: 'smooth'});
  }

  private updateScrollState(): void {
    const {scrollTop, scrollHeight, clientHeight} = this.document.documentElement;

    this.canScrollUp.set(scrollTop > 100);
    this.canScrollDown.set(scrollTop < scrollHeight - clientHeight - 10);
  }
}

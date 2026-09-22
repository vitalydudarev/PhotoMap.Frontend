import {DOCUMENT, NgClass} from '@angular/common';
import {Component, HostListener, OnInit, ViewEncapsulation, inject} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

@Component({
  selector: 'app-scroll-control',
  templateUrl: './scroll-control.component.html',
  styleUrls: ['./scroll-control.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  imports: [MatButtonModule, MatIconModule, NgClass],
})
export class ScrollControlComponent implements OnInit {
  canScrollUp = false;
  canScrollDown = false;

  private readonly document = inject(DOCUMENT);

  ngOnInit() {
    this.checkIfCanScrollDown();
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.checkIfCanScrollUp();
    this.checkIfCanScrollDown();
  }

  scrollToTop() {
    const documentElement = this.document.documentElement;
    const view = this.document.defaultView;

    const smoothscroll = () => {
      const currentPosition = documentElement.scrollTop;

      if (currentPosition > 0) {
        view?.requestAnimationFrame(smoothscroll);
        view?.scrollTo(0, currentPosition - currentPosition / 8);
      }
    };

    smoothscroll();
  }

  scrollToBottom(): void {
    const documentElement = this.document.documentElement;
    const view = this.document.defaultView;

    const smoothscroll = () => {
      const currentPosition = documentElement.scrollTop;
      const endPosition = documentElement.scrollHeight - documentElement.clientHeight;
      const diff = endPosition - currentPosition;
      const newPosition = currentPosition + diff / 8;

      if (currentPosition + 10 < endPosition) {
        view?.requestAnimationFrame(smoothscroll);
        view?.scrollTo(0, newPosition);
      }
    };

    smoothscroll();
  }

  private checkIfCanScrollUp() {
    const documentElement = this.document.documentElement;
    const scrollY = this.document.defaultView?.scrollY ?? 0;

    if (scrollY || documentElement.scrollTop > 100) {
      this.canScrollUp = true;
    } else if ((this.canScrollUp && scrollY) || documentElement.scrollTop < 10) {
      this.canScrollUp = false;
    }
  }

  private checkIfCanScrollDown() {
    const documentElement = this.document.documentElement;

    this.canScrollDown = documentElement.scrollTop < documentElement.scrollHeight - documentElement.clientHeight;
  }
}

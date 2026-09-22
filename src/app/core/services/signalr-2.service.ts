import {HubConnection, HubConnectionBuilder} from '@microsoft/signalr';

export class SignalRService2 {
  private hubConnection: HubConnection | undefined;
  private url = 'https://localhost:5001/notifications?userId=';

  public startConnection(userId: number): void {
    const url = this.url + userId;
    this.hubConnection = new HubConnectionBuilder().withUrl(url).build();
    this.hubConnection.start().then(
      () => {
        this.registerServerEvents();
      },
      (error) => console.error(error),
    );
  }

  private registerServerEvents(): void {
    if (this.hubConnection) {
      this.hubConnection.on('Error', () => {
        //   this.error$.next(question);
      });

      this.hubConnection.on('Progress', () => {
        //   this.progress$.next({ player, guess });
      });
    }
  }
}

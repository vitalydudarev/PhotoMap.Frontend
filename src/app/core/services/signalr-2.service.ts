import {HubConnection, HubConnectionBuilder} from '@aspnet/signalr';

export class SignalRService2 {
  private hubConnection: HubConnection | undefined;
  private url = 'https://localhost:5001/notifications?userId=';

  public startConnection(userId: number): void {
    const url = this.url + userId;
    this.hubConnection = new HubConnectionBuilder().withUrl(this.url).build();
    this.hubConnection.start().then(
      () => {
        console.log('Hub connection started!');
        this.registerServerEvents();
      },
      (error) => console.error(error)
    );
  }

  private registerServerEvents(): void {
    if (this.hubConnection) {
      this.hubConnection.on('Error', (error: any) => {
        //   this.error$.next(question);
      });

      this.hubConnection.on('Progress', (progress: any) => {
        //   this.progress$.next({ player, guess });
      });
    }
  }
}

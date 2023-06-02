import {HubConnection, HubConnectionBuilder} from '@aspnet/signalr';

export abstract class SignalRService {
  hubConnection?: HubConnection;

  protected abstract hubEvents: string[];
  protected abstract hubUrl: string;

  startHubConnection(): Promise<void> {
    if (this.hubConnection) {
      return this.hubConnection.start();
    }

    return Promise.resolve();
  }

  stopHubConnection(): Promise<any> {
    if (this.hubConnection) {
      return this.hubConnection.stop();
    }

    return Promise.resolve();
  }

  protected buildHubConnection(hubUrl: string): void {
    this.hubUrl = hubUrl;
    this.hubConnection = new HubConnectionBuilder().withUrl(this.hubUrl).build();
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    if (!this.hubEvents) {
      return;
    }

    // TODO: restore
    /*this.hubEvents.forEach(method => {
            this.hubConnection.on(method, (args: any[]) => { this[method](args); });
        });*/
  }
}

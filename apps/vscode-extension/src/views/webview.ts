import * as vscode from "vscode";

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private static readonly viewType = "jjhub.dashboard";

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly daemonUrl: string,
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml();

    this.panel.onDidDispose(
      () => {
        DashboardPanel.currentPanel = undefined;
        for (const d of this.disposables) {
          d.dispose();
        }
      },
      null,
      this.disposables,
    );
  }

  /** Show the dashboard panel, creating it if needed. */
  static show(extensionUri: vscode.Uri, daemonUrl: string): void {
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      DashboardPanel.viewType,
      "JJHub Dashboard",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, daemonUrl);
  }

  private getHtml(): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JJHub Dashboard</title>
  <style>
    html, body, iframe {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      border: none;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <iframe src="${this.daemonUrl}" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
</body>
</html>`;
  }
}

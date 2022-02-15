import * as vscode from 'vscode';

const POM_SELECTOR = { language: 'xml', pattern: '**/pom.xml' };

export function activate(context: vscode.ExtensionContext) {
	const provider = new PomFoldingRangeProvider();
	const disposable = vscode.languages.registerFoldingRangeProvider(POM_SELECTOR, provider);
	context.subscriptions.push(disposable);
}

class PomFoldingRangeProvider implements vscode.FoldingRangeProvider {
	provideFoldingRanges(document: vscode.TextDocument, context: vscode.FoldingContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FoldingRange[]> {
		//TODO The extension can't be implemented with the current API.
		//    We can only fold from line to line and without custom text for folded region.
		return [];
	}
}

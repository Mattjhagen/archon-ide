import SwiftUI
import WebKit

struct PreviewPaneView: UIViewRepresentable {
    var htmlContent: String
    
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        // Simple configuration for local html rendering
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        uiView.loadHTMLString(htmlContent, baseURL: nil)
    }
}

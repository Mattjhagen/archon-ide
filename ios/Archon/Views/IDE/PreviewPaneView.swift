import SwiftUI
import WebKit

class ArchonSchemeHandler: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else { return }
        let fileName = url.lastPathComponent
        
        var contentData: Data? = nil
        var mimeType = "text/plain"
        
        if let workspaceURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?.appendingPathComponent("workspace.json"),
           let data = try? Data(contentsOf: workspaceURL),
           let fileTree = try? JSONDecoder().decode([FileNode].self, from: data) {
            
            func findContent(nodes: [FileNode], name: String) -> String? {
                for node in nodes {
                    if node.name == name { return node.content }
                    if let children = node.children, let found = findContent(nodes: children, name: name) { return found }
                }
                return nil
            }
            
            if let contentString = findContent(nodes: fileTree, name: fileName) {
                contentData = contentString.data(using: .utf8)
                if fileName.hasSuffix(".css") { mimeType = "text/css" }
                if fileName.hasSuffix(".js") { mimeType = "application/javascript" }
                if fileName.hasSuffix(".html") { mimeType = "text/html" }
            }
        }
        
        let response = HTTPURLResponse(url: url, statusCode: contentData != nil ? 200 : 404, httpVersion: nil, headerFields: ["Content-Type": mimeType])!
        urlSchemeTask.didReceive(response)
        if let data = contentData {
            urlSchemeTask.didReceive(data)
        }
        urlSchemeTask.didFinish()
    }
    
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
    }
}

struct PreviewPaneView: UIViewRepresentable {
    var htmlContent: String
    
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let handler = ArchonSchemeHandler()
        config.setURLSchemeHandler(handler, forURLScheme: "archon")
        
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        let baseURL = URL(string: "archon://local/")
        uiView.loadHTMLString(htmlContent, baseURL: baseURL)
    }
}

import SwiftUI
import UIKit

struct SyntaxEditorView: UIViewRepresentable {
    enum Language {
        case javascript, html, swift
    }

    @Binding var text: String
    var language: Language = .swift

    func makeUIView(context: Context) -> CodeTextView {
        let editor = CodeTextView()
        editor.delegate = context.coordinator
        editor.language = language
        editor.text = text
        editor.applyHighlighting()
        return editor
    }

    func updateUIView(_ uiView: CodeTextView, context: Context) {
        uiView.language = language

        // Avoid resetting selection while the user is typing.
        guard uiView.text != text else { return }

        let selection = uiView.selectedRange
        uiView.text = text
        uiView.applyHighlighting()
        uiView.selectedRange = NSRange(
            location: min(selection.location, (uiView.text as NSString).length),
            length: 0
        )
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text)
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        @Binding private var text: String

        init(text: Binding<String>) {
            _text = text
        }

        func textViewDidChange(_ textView: UITextView) {
            text = textView.text
            (textView as? CodeTextView)?.applyHighlighting()
        }

        func textView(
            _ textView: UITextView,
            shouldChangeTextIn range: NSRange,
            replacementText replacementText: String
        ) -> Bool {
            guard replacementText == "\n",
                  let editor = textView as? CodeTextView
            else {
                return true
            }

            let source = textView.text as NSString
            let prefix = source.substring(to: range.location)
            let currentLine = prefix.components(separatedBy: .newlines).last ?? ""

            let indentation = currentLine.prefix { $0 == " " || $0 == "\t" }
            let trimmedLine = currentLine.trimmingCharacters(in: .whitespaces)

            // Add one indentation level after opening a block.
            let addsIndent = trimmedLine.hasSuffix("{")
                || trimmedLine.hasSuffix("[")
                || trimmedLine.hasSuffix("(")

            let extraIndent = addsIndent ? "    " : ""
            let insertion = "\n" + indentation + extraIndent

            textView.replace(range, withText: insertion)
            editor.applyHighlighting()
            return false
        }
    }
}

final class CodeTextView: UITextView {
    var language: SyntaxEditorView.Language = .swift {
        didSet { applyHighlighting() }
    }

    private let gutterWidth: CGFloat = 52
    private let codeFont = UIFont.monospacedSystemFont(ofSize: 14, weight: .regular)

    private lazy var keyboardToolbar: UIToolbar = {
        let toolbar = UIToolbar()
        toolbar.sizeToFit()

        let symbols = ["{", "[", "(", "\"", "'", "=", ";", "/", "Tab"]
        toolbar.items = symbols.map { symbol in
            UIBarButtonItem(
                title: symbol,
                style: .plain,
                target: self,
                action: #selector(insertCodingSymbol(_:))
            )
        }

        return toolbar
    }()

    init() {
        super.init(frame: .zero, textContainer: nil)
        
        self.inputAccessoryView = keyboardToolbar

        backgroundColor = UIColor.systemBackground
        textColor = UIColor.label
        font = codeFont
        autocorrectionType = .no
        autocapitalizationType = .none
        smartDashesType = .no
        smartQuotesType = .no
        smartInsertDeleteType = .no
        keyboardDismissMode = .interactive
        alwaysBounceVertical = true

        textContainerInset = UIEdgeInsets(top: 14, left: gutterWidth + 10, bottom: 14, right: 14)
        textContainer.lineFragmentPadding = 0
        layoutManager.allowsNonContiguousLayout = false
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    @objc private func insertCodingSymbol(_ sender: UIBarButtonItem) {
        guard let symbol = sender.title else { return }

        let insertion = symbol == "Tab" ? "    " : symbol
        replace(selectedRange, withText: insertion)
        applyHighlighting()
    }

    override func draw(_ rect: CGRect) {
        super.draw(rect)

        guard let context = UIGraphicsGetCurrentContext() else { return }

        let gutterRect = CGRect(
            x: 0,
            y: 0,
            width: gutterWidth,
            height: bounds.height
        )

        context.setFillColor(UIColor.secondarySystemBackground.cgColor)
        context.fill(gutterRect)

        context.setStrokeColor(UIColor.separator.cgColor)
        context.setLineWidth(1)
        context.move(to: CGPoint(x: gutterWidth, y: 0))
        context.addLine(to: CGPoint(x: gutterWidth, y: bounds.height))
        context.strokePath()

        drawLineNumbers()
    }

    private func drawLineNumbers() {
        let visibleRect = CGRect(
            x: contentOffset.x,
            y: contentOffset.y,
            width: bounds.width,
            height: bounds.height
        )

        let glyphRange = layoutManager.glyphRange(
            forBoundingRect: visibleRect,
            in: textContainer
        )

        var lineNumber = 1
        let visibleCharacterRange = layoutManager.characterRange(
            forGlyphRange: glyphRange,
            actualGlyphRange: nil
        )

        let precedingText = (text as NSString).substring(to: visibleCharacterRange.location)
        lineNumber += precedingText.filter { $0 == "\n" }.count

        var glyphIndex = glyphRange.location

        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.monospacedDigitSystemFont(ofSize: 12, weight: .regular),
            .foregroundColor: UIColor.secondaryLabel
        ]

        while glyphIndex < NSMaxRange(glyphRange) {
            var lineRange = NSRange()
            let lineRect = layoutManager.lineFragmentRect(
                forGlyphAt: glyphIndex,
                effectiveRange: &lineRange
            )

            let number = "\(lineNumber)" as NSString
            let size = number.size(withAttributes: attributes)

            let point = CGPoint(
                x: gutterWidth - size.width - 8,
                y: lineRect.minY + textContainerInset.top
            )

            number.draw(at: point, withAttributes: attributes)

            glyphIndex = NSMaxRange(lineRange)
            lineNumber += 1
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        setNeedsDisplay()
    }

    func applyHighlighting() {
        let selection = selectedRange
        let source = text ?? ""
        let fullRange = NSRange(location: 0, length: (source as NSString).length)

        let baseAttributes: [NSAttributedString.Key: Any] = [
            .font: codeFont,
            .foregroundColor: UIColor.label
        ]

        textStorage.beginEditing()
        textStorage.setAttributes(baseAttributes, range: fullRange)

        switch language {
        case .javascript:
            highlightJavaScript(source, range: fullRange)

        case .html:
            highlightHTML(source, range: fullRange)

        case .swift:
            highlightSwift(source, range: fullRange)
        }

        textStorage.endEditing()
        selectedRange = selection
        setNeedsDisplay()
    }

    private func highlightJavaScript(_ source: String, range: NSRange) {
        applyRegex(
            #"\b(const|let|var|function|return|if|else|for|while|async|await|import|from|export|class|new|throw|try|catch)\b"#,
            in: source,
            color: .systemPurple
        )

        applyRegex(#""(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`"#, in: source, color: .systemGreen)
        applyRegex(#"//.*|/\*[\s\S]*?\*/"#, in: source, color: .systemGray)
        applyRegex(#"\b\d+(\.\d+)?\b"#, in: source, color: .systemOrange)
    }

    private func highlightSwift(_ source: String, range: NSRange) {
        applyRegex(
            #"\b(import|let|var|func|return|if|else|guard|for|while|switch|case|struct|class|enum|protocol|extension|async|await|throws|try|private|public|internal)\b"#,
            in: source,
            color: .systemPurple
        )

        applyRegex(#""(?:\\.|[^"])*""#, in: source, color: .systemGreen)
        applyRegex(#"//.*|/\*[\s\S]*?\*/"#, in: source, color: .systemGray)
        applyRegex(#"\b(true|false|nil)\b"#, in: source, color: .systemOrange)
        applyRegex(#"\b\d+(\.\d+)?\b"#, in: source, color: .systemOrange)
    }

    private func highlightHTML(_ source: String, range: NSRange) {
        applyRegex(#"</?[A-Za-z][^>]*>"#, in: source, color: .systemPurple)
        applyRegex(#"\b[A-Za-z\-]+(?==)"#, in: source, color: .systemBlue)
        applyRegex(#""[^"]*"|'[^']*'"#, in: source, color: .systemGreen)
        applyRegex(#"<!--[\s\S]*?-->"#, in: source, color: .systemGray)
    }

    private func applyRegex(_ pattern: String, in source: String, color: UIColor) {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return }

        let range = NSRange(location: 0, length: (source as NSString).length)

        regex.enumerateMatches(in: source, range: range) { match, _, _ in
            guard let match else { return }

            self.textStorage.addAttribute(
                .foregroundColor,
                value: color,
                range: match.range
            )
        }
    }
}

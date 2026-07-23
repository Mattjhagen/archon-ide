import SwiftUI
import UIKit

/// Archon IDE design tokens — graphite-indigo surfaces with a single
/// neon-teal active-state signal. UIKit mirrors exist for the
/// UITextView-based syntax editor.
enum IDETheme {

    // MARK: Surfaces (graphite-indigo scale)

    static let base       = Color(hex: 0x0D0D15)
    static let surface    = Color(hex: 0x181826)
    static let elevated   = Color(hex: 0x202040)
    static let border     = Color(hex: 0x2C2C5A)
    static let borderFaint = Color(hex: 0x1A1A32)

    // MARK: Accent (neon teal — the only active-state hue)

    static let accent     = Color(hex: 0x00E8CA)
    static let accentDim  = Color(hex: 0x00E8CA).opacity(0.14)
    static let accentDeep = Color(hex: 0x007A8A)

    // MARK: Text

    static let text       = Color(hex: 0xEEEEF8)
    static let textSub    = Color(hex: 0x8888AA)
    static let textMuted  = Color(hex: 0x484870)

    // MARK: Semantic (distinct from accent)

    static let success    = Color(hex: 0x23D18B)
    static let danger     = Color(hex: 0xF14C4C)
    static let warning    = Color(hex: 0xE5C241)

    // MARK: UIKit mirrors (syntax editor)

    enum UIKitColors {
        static let base      = UIColor(hex: 0x0D0D15)
        static let surface   = UIColor(hex: 0x181826)
        static let border    = UIColor(hex: 0x2C2C5A)
        static let text      = UIColor(hex: 0xEEEEF8)
        static let textMuted = UIColor(hex: 0x8888AA)
        static let accent    = UIColor(hex: 0x00E8CA)
        static let keyword   = UIColor(hex: 0xFF79C6)
        static let string    = UIColor(hex: 0xF1FA8C)
        static let comment   = UIColor(hex: 0x6272A4)
        static let number    = UIColor(hex: 0xBD93F9)
        static let attribute = UIColor(hex: 0x8BE9FD)
    }
}

private extension Color {
    init(hex: UInt32) {
        self.init(.sRGB,
                  red:   Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >>  8) & 0xFF) / 255,
                  blue:  Double( hex        & 0xFF) / 255,
                  opacity: 1)
    }
}

private extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red:   CGFloat((hex >> 16) & 0xFF) / 255,
                  green: CGFloat((hex >>  8) & 0xFF) / 255,
                  blue:  CGFloat( hex        & 0xFF) / 255,
                  alpha: 1)
    }
}

// MARK: - Shared styles

/// Filled teal call-to-action. Dark label on the bright accent
/// keeps WCAG contrast; scale feedback respects Reduce Motion.
struct IDEAccentButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .fontDesign(.rounded)
            .foregroundStyle(IDETheme.base)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .frame(minHeight: 44)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(IDETheme.accent.opacity(configuration.isPressed ? 0.75 : 1))
            )
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.97 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12),
                       value: configuration.isPressed)
    }
}

extension View {
    /// Minimum 44pt hit target without inflating visual size.
    func ideTouchTarget() -> some View {
        frame(minWidth: 44, minHeight: 44)
            .contentShape(Rectangle())
    }
}

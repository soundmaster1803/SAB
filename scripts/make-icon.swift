#!/usr/bin/env swift
// Generates AppIcon.icns for CineLink Bridge
// Run: swift scripts/make-icon.swift
import AppKit

func makeIcon(size: Int) -> NSImage {
    let s = CGFloat(size)
    let image = NSImage(size: NSSize(width: s, height: s))
    image.lockFocus()
    guard let ctx = NSGraphicsContext.current?.cgContext else { image.unlockFocus(); return image }

    let space = CGColorSpaceCreateDeviceRGB()

    // ── Rounded rect clip (macOS icon shape) ─────────────────────────────────
    let r = s * 0.225
    ctx.addPath(CGPath(roundedRect: CGRect(x: 0, y: 0, width: s, height: s),
                       cornerWidth: r, cornerHeight: r, transform: nil))
    ctx.clip()

    // ── Background: dark navy gradient ────────────────────────────────────────
    let bgColors = [NSColor(red: 0.07, green: 0.08, blue: 0.16, alpha: 1).cgColor,
                    NSColor(red: 0.03, green: 0.03, blue: 0.07, alpha: 1).cgColor] as CFArray
    let bg = CGGradient(colorsSpace: space, colors: bgColors, locations: [0, 1])!
    ctx.drawLinearGradient(bg, start: CGPoint(x: s/2, y: s), end: CGPoint(x: s/2, y: 0), options: [])

    // ── Subtle blue radial glow ───────────────────────────────────────────────
    let glowColors = [NSColor(red: 0.0, green: 0.48, blue: 1.0, alpha: 0.18).cgColor,
                      NSColor(red: 0.0, green: 0.48, blue: 1.0, alpha: 0.0).cgColor] as CFArray
    let glow = CGGradient(colorsSpace: space, colors: glowColors, locations: [0, 1])!
    ctx.drawRadialGradient(glow,
        startCenter: CGPoint(x: s * 0.5, y: s * 0.48), startRadius: 0,
        endCenter:   CGPoint(x: s * 0.5, y: s * 0.48), endRadius: s * 0.48,
        options: [])

    // ── Camera body ───────────────────────────────────────────────────────────
    let bx = s * 0.14, by = s * 0.29
    let bw = s * 0.72, bh = s * 0.38
    let br = s * 0.055
    ctx.setFillColor(NSColor(white: 0.92, alpha: 1).cgColor)
    ctx.addPath(CGPath(roundedRect: CGRect(x: bx, y: by, width: bw, height: bh),
                       cornerWidth: br, cornerHeight: br, transform: nil))
    ctx.fillPath()

    // ── Viewfinder bump ───────────────────────────────────────────────────────
    let vx = bx + bw * 0.10, vy = by + bh - s * 0.003
    let vw = bw * 0.30, vh = bh * 0.20
    ctx.setFillColor(NSColor(white: 0.92, alpha: 1).cgColor)
    ctx.addPath(CGPath(roundedRect: CGRect(x: vx, y: vy, width: vw, height: vh),
                       cornerWidth: vh / 2, cornerHeight: vh / 2, transform: nil))
    ctx.fillPath()

    // ── Lens outer ring (blue) ────────────────────────────────────────────────
    let lx = bx + bw * 0.46, ly = by + bh * 0.5
    let lR = bh * 0.37
    ctx.setFillColor(NSColor(red: 0.0, green: 0.478, blue: 1.0, alpha: 1).cgColor)
    ctx.addArc(center: CGPoint(x: lx, y: ly), radius: lR, startAngle: 0, endAngle: .pi * 2, clockwise: false)
    ctx.fillPath()

    // ── Lens inner (dark) ─────────────────────────────────────────────────────
    ctx.setFillColor(NSColor(red: 0.04, green: 0.04, blue: 0.09, alpha: 1).cgColor)
    ctx.addArc(center: CGPoint(x: lx, y: ly), radius: lR * 0.62, startAngle: 0, endAngle: .pi * 2, clockwise: false)
    ctx.fillPath()

    // ── Lens reflection ───────────────────────────────────────────────────────
    ctx.setFillColor(NSColor(white: 1, alpha: 0.65).cgColor)
    ctx.addArc(center: CGPoint(x: lx - lR * 0.21, y: ly + lR * 0.21), radius: lR * 0.22,
               startAngle: 0, endAngle: .pi * 2, clockwise: false)
    ctx.fillPath()

    // ── Flash/status dot (amber) ──────────────────────────────────────────────
    if s >= 32 {
        ctx.setFillColor(NSColor(red: 1.0, green: 0.75, blue: 0.1, alpha: 0.9).cgColor)
        ctx.addArc(center: CGPoint(x: bx + bw * 0.86, y: by + bh * 0.68), radius: max(s * 0.028, 1),
                   startAngle: 0, endAngle: .pi * 2, clockwise: false)
        ctx.fillPath()
    }

    image.unlockFocus()
    return image
}

// ── Write iconset ─────────────────────────────────────────────────────────────
let dest = "/tmp/AppIcon.iconset"
try? FileManager.default.createDirectory(atPath: dest, withIntermediateDirectories: true)

let specs: [(String, Int)] = [
    ("icon_16x16.png",      16),
    ("icon_16x16@2x.png",   32),
    ("icon_32x32.png",      32),
    ("icon_32x32@2x.png",   64),
    ("icon_128x128.png",   128),
    ("icon_128x128@2x.png",256),
    ("icon_256x256.png",   256),
    ("icon_256x256@2x.png",512),
    ("icon_512x512.png",   512),
    ("icon_512x512@2x.png",1024),
]

for (name, sz) in specs {
    let img  = makeIcon(size: sz)
    let cgImg = img.cgImage(forProposedRect: nil, context: nil, hints: nil)!
    let rep  = NSBitmapImageRep(cgImage: cgImg)
    rep.size = NSSize(width: sz, height: sz)
    let png  = rep.representation(using: .png, properties: [:])!
    try! png.write(to: URL(fileURLWithPath: "\(dest)/\(name)"))
    print("✓ \(name)")
}
print("→ iconutil -c icns \(dest) -o AppIcon.icns")

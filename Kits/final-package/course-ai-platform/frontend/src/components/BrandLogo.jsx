// The selectAi logo (public/selectai-logo.png, 276x64). Used wherever the platform
// shows its brand so the mark lives in one place.
export default function BrandLogo({ className = "h-8" }) {
  return <img src="/selectai-logo.png" alt="selectAi" className={`w-auto ${className}`} />;
}

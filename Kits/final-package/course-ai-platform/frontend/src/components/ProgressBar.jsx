export default function ProgressBar({ percent, height = "h-1.5" }) {
  return (
    <div className={`w-full ${height} rounded-full bg-ink-800 overflow-hidden`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-brass-500 to-teal-500 transition-all duration-500 ease-out"
        style={{ width: `${Math.max(percent, 3)}%` }}
      />
    </div>
  );
}

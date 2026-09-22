interface PageHeaderProps {
  sectionName: string
}

export default function PageHeader({ sectionName }: PageHeaderProps) {
  return (
    <header className="px-6 py-4 bg-gray-50 border-b border-gray-200">
      <h1 className="text-xl font-bold text-gray-900">
        Module 01 — Foundations
      </h1>
      <p className="text-sm text-gray-600 mt-1">{sectionName}</p>
    </header>
  )
}

import { NavLink } from 'react-router-dom'

const navLinks = [
  { to: '/playground', label: 'Playground' },
  { to: '/query-router', label: 'Query Router' },
  { to: '/eval', label: 'Eval Dashboard' },
  { to: '/labs', label: 'Lab Viewer' },
]

export default function NavBar() {
  return (
    <nav className="flex gap-6 px-6 py-3 bg-white border-b border-gray-200">
      {navLinks.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            isActive
              ? 'font-semibold text-blue-600 border-b-2 border-blue-600 pb-1'
              : 'text-gray-600 hover:text-gray-900 pb-1'
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

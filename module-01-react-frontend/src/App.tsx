import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import Step1EnvSetup from './pages/Step1EnvSetup'
import Step2Groq from './pages/Step2Groq'
import Step3Prompts from './pages/Step3Prompts'
import Step4Chains from './pages/Step4Chains'
import Step5Routing from './pages/Step5Routing'
import Step6Eval from './pages/Step6Eval'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/step/1" replace />} />
          <Route path="step/1" element={<Step1EnvSetup />} />
          <Route path="step/2" element={<Step2Groq />} />
          <Route path="step/3" element={<Step3Prompts />} />
          <Route path="step/4" element={<Step4Chains />} />
          <Route path="step/5" element={<Step5Routing />} />
          <Route path="step/6" element={<Step6Eval />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

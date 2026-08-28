import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import PatientRegister from "./pages/PatientRegister";
import AdminDashboard from "./pages/AdminDashboard";
import PatientDashboard from "./pages/PatientDashboard";
import DoctorList from "./pages/DoctorList";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/register" element={<PatientRegister />} />

        <Route path="/admin" element={<AdminDashboard />} />
        
        <Route path="/patient" element={<PatientDashboard />}/>

        <Route path="/patient/doctors" element={<DoctorList />}
/>

        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import PatientRegister from "./pages/PatientRegister";
import AdminDashboard from "./pages/AdminDashboard";
import PatientDashboard from "./pages/PatientDashboard";
import DoctorList from "./pages/DoctorList";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public Home Page */}
        <Route
          path="/"
          element={<HomePage />}
        />

        {/* Authentication */}
        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/register"
          element={<PatientRegister />}
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={<AdminDashboard />}
        />

        {/* Patient */}
        <Route
          path="/patient"
          element={<PatientDashboard />}
        />

        {/* Patient Doctors */}
        <Route
          path="/patient/doctors"
          element={<DoctorList />}
        />

        {/* Unknown route */}
        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
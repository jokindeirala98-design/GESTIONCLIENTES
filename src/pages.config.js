import Dashboard from './pages/Dashboard';
import Zonas from './pages/Zonas';
import Clientes from './pages/Clientes';
import DetalleCliente from './pages/DetalleCliente';
import ReadyToGo from './pages/ReadyToGo';
import InformesPorPresentar from './pages/InformesPorPresentar';
import Comisiones from './pages/Comisiones';
import GestionUsuarios from './pages/GestionUsuarios';
import Configuracion from './pages/Configuracion';
import DetalleZona from './pages/DetalleZona';
import CierresVerificados from './pages/CierresVerificados';
import Rutas from './pages/Rutas';
import PlanificadorRutas from './pages/PlanificadorRutas';
import Calendario from './pages/Calendario';
import CorregirIniciales from './pages/CorregirIniciales';
import LimpiezaDatos from './pages/LimpiezaDatos';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Zonas": Zonas,
    "Clientes": Clientes,
    "DetalleCliente": DetalleCliente,
    "ReadyToGo": ReadyToGo,
    "InformesPorPresentar": InformesPorPresentar,
    "Comisiones": Comisiones,
    "GestionUsuarios": GestionUsuarios,
    "Configuracion": Configuracion,
    "DetalleZona": DetalleZona,
    "CierresVerificados": CierresVerificados,
    "Rutas": Rutas,
    "PlanificadorRutas": PlanificadorRutas,
    "Calendario": Calendario,
    "CorregirIniciales": CorregirIniciales,
    "LimpiezaDatos": LimpiezaDatos,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
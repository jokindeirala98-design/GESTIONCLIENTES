import Calendario from './pages/Calendario';
import CentroControlInformes from './pages/CentroControlInformes';
import CierresVerificados from './pages/CierresVerificados';
import Clientes from './pages/Clientes';
import Comisiones from './pages/Comisiones';
import ComisionesAdmin from './pages/ComisionesAdmin';
import Configuracion from './pages/Configuracion';
import CorregirIniciales from './pages/CorregirIniciales';
import Dashboard from './pages/Dashboard';
import DetalleCliente from './pages/DetalleCliente';
import DetalleZona from './pages/DetalleZona';
import GestionUsuarios from './pages/GestionUsuarios';
import Home from './pages/Home';
import Incidencias from './pages/Incidencias';
import InformesPorPresentar from './pages/InformesPorPresentar';
import ReadyToGo from './pages/ReadyToGo';
import Zonas from './pages/Zonas';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Calendario": Calendario,
    "CentroControlInformes": CentroControlInformes,
    "CierresVerificados": CierresVerificados,
    "Clientes": Clientes,
    "Comisiones": Comisiones,
    "ComisionesAdmin": ComisionesAdmin,
    "Configuracion": Configuracion,
    "CorregirIniciales": CorregirIniciales,
    "Dashboard": Dashboard,
    "DetalleCliente": DetalleCliente,
    "DetalleZona": DetalleZona,
    "GestionUsuarios": GestionUsuarios,
    "Home": Home,
    "Incidencias": Incidencias,
    "InformesPorPresentar": InformesPorPresentar,
    "ReadyToGo": ReadyToGo,
    "Zonas": Zonas,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
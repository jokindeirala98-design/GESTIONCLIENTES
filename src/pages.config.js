import Dashboard from './pages/Dashboard';
import Zonas from './pages/Zonas';
import Clientes from './pages/Clientes';
import DetalleCliente from './pages/DetalleCliente';
import ReadyToGo from './pages/ReadyToGo';
import InformesPorPresentar from './pages/InformesPorPresentar';
import Comisiones from './pages/Comisiones';
import GestionUsuarios from './pages/GestionUsuarios';
import Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Zonas": Zonas,
    "Clientes": Clientes,
    "DetalleCliente": DetalleCliente,
    "ReadyToGo": ReadyToGo,
    "InformesPorPresentar": InformesPorPresentar,
    "Comisiones": Comisiones,
    "GestionUsuarios": GestionUsuarios,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: Layout,
};
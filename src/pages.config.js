/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
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
import Citas from './pages/Citas';
import InformesPotencias from './pages/InformesPotencias';
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
    "Citas": Citas,
    "InformesPotencias": InformesPotencias,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
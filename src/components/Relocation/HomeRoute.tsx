import { Navigate, useLocation } from 'react-router-dom';
import { readShareStateFromSearch } from '../Calculator/logic';
import { RelocationHome } from './index';

// Preserve calculator share links created before the relocation landing page.
export default function HomeRoute() {
  const { search } = useLocation();
  return readShareStateFromSearch(search)
    ? <Navigate to={`/calculator${search}`} replace />
    : <RelocationHome />;
}

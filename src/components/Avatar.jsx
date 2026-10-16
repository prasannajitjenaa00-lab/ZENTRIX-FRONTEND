import { initials } from '../utils/format';
export default function Avatar({ name, admin = false, id }) { return <div className={`avatar ${admin ? 'admin' : ''}`} id={id}>{initials(name)}</div>; }

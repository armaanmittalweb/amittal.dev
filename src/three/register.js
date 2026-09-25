// Loaded with a dynamic import, so three.js lands in its own chunk and is only
// fetched once a 3D view is on screen.
import { Archive3D } from './archive3d.js'
import { Vault3D } from './vault3d.js'

if (!customElements.get('archive-3d')) customElements.define('archive-3d', Archive3D)
if (!customElements.get('vault-3d')) customElements.define('vault-3d', Vault3D)

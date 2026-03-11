import {blockContentType} from './blockContentType'
import {categoryType} from './categoryType'
import {postType} from './postType'
import {authorType} from './authorType'

// AQUI ESTÁ O SEGREDO: Exportar um objeto chamado 'schema'
// ou renomear o import no config. Vamos exportar um objeto chamado 'schema'
// para que o import {schema} funcione.

export const schemaTypes = [blockContentType, categoryType, postType, authorType]

export const schema = {
  types: schemaTypes,
}
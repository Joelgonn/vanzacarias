// sanity.config.ts
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'

// Usando o @/ corretamente (aponta para a pasta /src)
import {apiVersion, dataset, projectId} from '@/sanity/env'
import {schemaTypes} from '@/sanity/schemaTypes'
import {structure} from '@/sanity/structure'

export default defineConfig({
  name: 'default',
  title: 'Vanusa Zacarias Nutrição',
  projectId,
  dataset,
  apiVersion,
  plugins: [structureTool({ structure })],
  schema: {
    types: schemaTypes,
  },
})
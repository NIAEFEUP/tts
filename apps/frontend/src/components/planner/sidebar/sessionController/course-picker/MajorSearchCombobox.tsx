import { useState, useContext } from 'react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons//react/24/solid'
import { Major } from '../../../../../@types'
import MajorContext from '../../../../../contexts/MajorContext'
import { cn } from '../../../../../utils'
import { Button, buttonStyle } from '../../../../ui/new/button'
import { Menu } from '../../../../ui/new/menu'
import { AnalyticsTracker } from '../../../../../utils/AnalyticsTracker'

interface Props {
  selectedMajor: Major | null
  setSelectedMajor: (major: Major | null) => void
  allowedAcronyms?: string[]
}

/**
 * Combobox also with a searchbar in which the user will be able to write the major he / she
 * wants to select courses from. They can type the major or click on the rightmost corner to open
 * the list of possible majors.
 */
const MajorSearchCombobox = ({ selectedMajor, setSelectedMajor, allowedAcronyms }: Props) => {
  const { majors, majorsError, majorsLoading, retryMajors } = useContext(MajorContext)
  const [search, setSearch] = useState('')

  const match = (string: string, query: string) =>
    string.toLowerCase().replace(/\s+/g, '').includes(query.toLowerCase().replace(/\s+/g, '')) ||
    string
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, '')
      .replace('.', '')
      .replace(':', '')
      .includes(query.toLowerCase().replace(/\s+/g, ''))

  const filteredMajors = majors
    ? majors
        .filter((major) => !allowedAcronyms || allowedAcronyms.includes(major.acronym))
        .filter((major) => {
          if (!search) return true
          const searchWords = search.toLowerCase().replace(/\s+/g, ' ').trim().split(' ')
          return searchWords.every(
            (word) =>
              match(major.name, word) ||
              match(major.acronym, word) ||
              match(major.faculty_id, word) ||
              major.faculties.some((faculty) => match(faculty, word)),
          )
        })
    : []

  return (
    <Menu
      onOpenChange={(isOpen) => {
        if (!isOpen) setTimeout(() => setSearch(''), 200)
      }}
    >
      <Menu.Trigger
        role="combobox"
        className={buttonStyle({
          variant: 'outline',
          className: 'w-full justify-between dark:bg-darker dark:text-slate-50',
        })}
      >
        <p className="truncate">{selectedMajor ? selectedMajor.name : 'Seleciona um curso...'}</p>
        <ChevronUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Menu.Trigger>
      <Menu.Items
        className="flex flex-col overflow-hidden"
        style={{ width: 'var(--width)' }}
        onWheel={(e) => e.stopPropagation()}
      >
        <Menu.SearchInput
          autoFocus
          placeholder="Procurar curso..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          isLoading={majorsLoading}
        />
        <div className="overflow-y-auto overscroll-contain">
          {majorsError ? (
            <Menu.Empty className="flex flex-col items-center gap-3 py-4">
              <span>Não foi possível carregar a lista de cursos.</span>
              <Button variant="outline" size="sm" onClick={() => retryMajors()}>
                Tentar novamente
              </Button>
            </Menu.Empty>
          ) : (
            <>
              {selectedMajor && <Menu.Item onSelect={() => setSelectedMajor(null)}>Remover Seleção</Menu.Item>}
              {!majorsLoading && filteredMajors.length === 0 && (
                <Menu.Empty>Nenhum curso corresponde à tua pesquisa.</Menu.Empty>
              )}
              {filteredMajors.map((major) => (
                <Menu.Item
                  key={major.id}
                  onSelect={() => {
                    setSelectedMajor(major.id === selectedMajor?.id ? null : major)
                    AnalyticsTracker.majorSelected(major)
                  }}
                >
                  <span className="truncate">{`${major.name} (${major.acronym}) - ${major.faculties.map((faculty) => faculty.toUpperCase()).join(', ')}`}</span>
                  <CheckIcon
                    className={cn(
                      'ml-auto h-4 w-4 shrink-0',
                      selectedMajor?.id === major.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </Menu.Item>
              ))}
            </>
          )}
        </div>
      </Menu.Items>
    </Menu>
  )
}

export default MajorSearchCombobox

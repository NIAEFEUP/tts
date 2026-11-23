import useSWR from 'swr'
import adminScopeService from '../../api/services/adminScopeService'

export default () => useSWR('v1/admin/occurrences', adminScopeService.getOccurrences)

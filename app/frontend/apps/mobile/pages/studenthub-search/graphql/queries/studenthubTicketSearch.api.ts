import * as Types from '#shared/graphql/types.ts';

import gql from 'graphql-tag';
import * as VueApolloComposable from '@vue/apollo-composable';
import * as VueCompositionApi from 'vue';
export type ReactiveFunction<TParam> = () => TParam;

export const StudenthubTicketSearchDocument = gql`
    query studenthubTicketSearch($search: String!, $limit: Int = 20) {
  search(search: $search, onlyIn: Ticket, limit: $limit) {
    items {
      __typename
      ... on Ticket {
        id
        internalId
        number
        title
        updatedAt
        customer {
          id
          internalId
        }
        state {
          id
          name
          stateType {
            id
            name
          }
        }
      }
    }
  }
}
    `;
export function useStudenthubTicketSearchQuery(variables: Types.StudenthubTicketSearchQueryVariables | VueCompositionApi.Ref<Types.StudenthubTicketSearchQueryVariables> | ReactiveFunction<Types.StudenthubTicketSearchQueryVariables>, options: VueApolloComposable.UseQueryOptions<Types.StudenthubTicketSearchQuery, Types.StudenthubTicketSearchQueryVariables> | VueCompositionApi.Ref<VueApolloComposable.UseQueryOptions<Types.StudenthubTicketSearchQuery, Types.StudenthubTicketSearchQueryVariables>> | ReactiveFunction<VueApolloComposable.UseQueryOptions<Types.StudenthubTicketSearchQuery, Types.StudenthubTicketSearchQueryVariables>> = {}) {
  return VueApolloComposable.useQuery<Types.StudenthubTicketSearchQuery, Types.StudenthubTicketSearchQueryVariables>(StudenthubTicketSearchDocument, variables, options);
}
export function useStudenthubTicketSearchLazyQuery(variables?: Types.StudenthubTicketSearchQueryVariables | VueCompositionApi.Ref<Types.StudenthubTicketSearchQueryVariables> | ReactiveFunction<Types.StudenthubTicketSearchQueryVariables>, options: VueApolloComposable.UseQueryOptions<Types.StudenthubTicketSearchQuery, Types.StudenthubTicketSearchQueryVariables> | VueCompositionApi.Ref<VueApolloComposable.UseQueryOptions<Types.StudenthubTicketSearchQuery, Types.StudenthubTicketSearchQueryVariables>> | ReactiveFunction<VueApolloComposable.UseQueryOptions<Types.StudenthubTicketSearchQuery, Types.StudenthubTicketSearchQueryVariables>> = {}) {
  return VueApolloComposable.useLazyQuery<Types.StudenthubTicketSearchQuery, Types.StudenthubTicketSearchQueryVariables>(StudenthubTicketSearchDocument, variables, options);
}
export type StudenthubTicketSearchQueryCompositionFunctionResult = VueApolloComposable.UseQueryReturn<Types.StudenthubTicketSearchQuery, Types.StudenthubTicketSearchQueryVariables>;
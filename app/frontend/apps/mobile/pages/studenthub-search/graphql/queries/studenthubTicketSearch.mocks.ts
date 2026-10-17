import * as Types from '#shared/graphql/types.ts';

import * as Mocks from '#tests/graphql/builders/mocks.ts'
import * as Operations from './studenthubTicketSearch.api.ts'
import * as ErrorTypes from '#shared/types/error.ts'

export function mockStudenthubTicketSearchQuery(defaults: Mocks.MockDefaultsValue<Types.StudenthubTicketSearchQuery, Types.StudenthubTicketSearchQueryVariables>) {
  return Mocks.mockGraphQLResult(Operations.StudenthubTicketSearchDocument, defaults)
}

export function waitForStudenthubTicketSearchQueryCalls() {
  return Mocks.waitForGraphQLMockCalls<Types.StudenthubTicketSearchQuery>(Operations.StudenthubTicketSearchDocument)
}

export function mockStudenthubTicketSearchQueryError(message: string, extensions: {type: ErrorTypes.GraphQLErrorTypes }) {
  return Mocks.mockGraphQLResultWithError(Operations.StudenthubTicketSearchDocument, message, extensions);
}

// @flow

import React, { Fragment, Component, useCallback } from 'react'
import { connect } from 'react-redux'
import { openURL } from 'helpers/linking'
import { Trans, translate } from 'react-i18next'
import styled from 'styled-components'
import moment from 'moment'
import {
  getOperationAmountNumber,
  findOperationInAccount,
} from '@ledgerhq/live-common/lib/operation'
import { getTransactionExplorer, getDefaultExplorerView } from '@ledgerhq/live-common/lib/explorers'
import uniq from 'lodash/uniq'

import TrackPage from 'analytics/TrackPage'
import type { TokenAccount, Account, Operation } from '@ledgerhq/live-common/lib/types'
import {
  getAccountCurrency,
  getAccountUnit,
  getMainAccount,
} from '@ledgerhq/live-common/lib/account'
import { colors } from 'styles/theme'

import type { T } from 'types/common'
import { MODAL_OPERATION_DETAILS } from 'config/constants'

import { getMarketColor } from 'styles/helpers'
import Box from 'components/base/Box'
import Button from 'components/base/Button'
import Bar from 'components/base/Bar'
import FormattedVal from 'components/base/FormattedVal'
import Modal, { ModalBody } from 'components/base/Modal'
import Text from 'components/base/Text'
import LabelInfoTooltip from 'components/base/LabelInfoTooltip'
import OperationComponent from 'components/OperationsList/Operation'

import CopyWithFeedback from 'components/base/CopyWithFeedback'
import { accountSelector } from 'reducers/accounts'
import { openModal } from 'reducers/modals'

import { confirmationsNbForCurrencySelector, marketIndicatorSelector } from 'reducers/settings'
import IconChevronRight from 'icons/ChevronRight'
import CounterValue from 'components/CounterValue'
import ConfirmationCheck from 'components/OperationsList/ConfirmationCheck'
import Ellipsis from '../base/Ellipsis'

const OpDetailsSection = styled(Box).attrs({
  horizontal: true,
  alignItems: 'center',
  ff: 'Open Sans|SemiBold',
  fontSize: 4,
  color: 'grey',
})``

const OpDetailsTitle = styled(Box).attrs({
  ff: 'Museo Sans|ExtraBold',
  fontSize: 2,
  color: 'black',
  textTransform: 'uppercase',
  mb: 1,
})`
  letter-spacing: 2px;
`
export const Address = styled(Text).attrs({})`
  margin-left: -4px;
  border-radius: 4px;
  flex-wrap: wrap;
  padding: 4px;
  width: fit-content;
`

export const GradientHover = styled(Box).attrs({
  align: 'center',
  color: 'wallet',
})`
  background: white;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  padding-left: 20px;
  background: linear-gradient(to right, rgba(255, 255, 255, 0), #ffffff 20%);
`

const OpDetailsData = styled(Box).attrs({
  ff: 'Open Sans',
  color: 'smoke',
  fontSize: 4,
  relative: true,
})`
  ${GradientHover} {
    display: none;
  }

  &:hover ${GradientHover} {
    display: flex;
    & > * {
      cursor: pointer;
    }
  }

  &:hover ${Address} {
    background: ${colors.pillActiveBackground};
    color: ${colors.wallet};
    font-weight: 400;
  }
`

const NoMarginWrapper = styled.div`
  margin-left: -20px;
  margin-right: -20px;
`

const B = styled(Bar).attrs({
  color: 'lightGrey',
  size: 1,
})``

const mapDispatchToProps = {
  openModal,
}

const mapStateToProps = (state, { operationId, accountId, parentId }) => {
  const marketIndicator = marketIndicatorSelector(state)
  const parentAccount: ?Account = parentId && accountSelector(state, { accountId: parentId })
  let account: ?(TokenAccount | Account)
  if (parentAccount) {
    const { tokenAccounts } = parentAccount
    if (tokenAccounts) {
      account = tokenAccounts.find(t => t.id === accountId)
    }
  } else {
    account = accountSelector(state, { accountId })
  }
  const mainCurrency = parentAccount
    ? parentAccount.currency
    : account && account.type === 'Account'
    ? account.currency
    : null
  const confirmationsNb = mainCurrency
    ? confirmationsNbForCurrencySelector(state, { currency: mainCurrency })
    : 0
  const operation = account ? findOperationInAccount(account, operationId) : null
  return { marketIndicator, account, parentAccount, operation, confirmationsNb }
}

type Props = {
  t: T,
  operation: ?Operation,
  account: ?(Account | TokenAccount),
  parentAccount: ?Account,
  confirmationsNb: number,
  onClose: () => void,
  marketIndicator: *,
  openModal: typeof openModal,
  parentOperation?: Operation,
}
type openOperationType = 'goBack' | 'subOperation' | 'internalOperation'

const OperationDetails = connect(
  mapStateToProps,
  mapDispatchToProps,
)((props: Props) => {
  const {
    t,
    onClose,
    operation,
    account,
    parentAccount,
    confirmationsNb,
    marketIndicator,
    openModal,
    parentOperation,
  } = props
  if (!operation || !account) return null
  const mainAccount = getMainAccount(account, parentAccount)
  const { extra, hash, date, senders, type, fee, recipients } = operation
  const { name } = mainAccount
  const currency = getAccountCurrency(account)
  const unit = getAccountUnit(account)
  const amount = getOperationAmountNumber(operation)
  const isNegative = operation.type === 'OUT'
  const marketColor = getMarketColor({
    marketIndicator,
    isNegative,
  })
  const confirmations = operation.blockHeight ? mainAccount.blockHeight - operation.blockHeight : 0
  const isConfirmed = confirmations >= confirmationsNb

  const url = getTransactionExplorer(getDefaultExplorerView(mainAccount.currency), operation.hash)
  const uniqueSenders = uniq(senders)

  const { hasFailed } = operation
  const subOperations = operation.subOperations || []
  const internalOperations = operation.internalOperations || []

  const openOperation = useCallback(
    (type: openOperationType, operation: Operation, parentOperation?: Operation) => {
      const data = {
        operationId: operation.id,
        accountId: operation.accountId,
        parentOperation: undefined,
        parentId: undefined,
      }
      if (['subOperation', 'internalOperation'].includes(type)) {
        data.parentOperation = parentOperation
        if (type === 'subOperation') {
          data.parentId = account.id
        }
      }
      openModal(MODAL_OPERATION_DETAILS, data)
    },
    [openModal, account],
  )

  return (
    <ModalBody
      title={t('operationDetails.title')}
      onClose={onClose}
      onBack={parentOperation ? () => openOperation('goBack', parentOperation) : undefined}
      render={() => (
        <Box flow={3}>
          <Box alignItems="center" mt={1}>
            <ConfirmationCheck
              marketColor={marketColor}
              isConfirmed={isConfirmed}
              hasFailed={hasFailed}
              style={{
                transform: 'scale(1.5)',
              }}
              t={t}
              type={type}
              withTooltip={false}
            />
          </Box>
          <Box my={4} alignItems="center">
            <Box selectable>
              {hasFailed ? null : (
                <FormattedVal
                  color={amount.isNegative() ? 'smoke' : undefined}
                  unit={unit}
                  alwaysShowSign
                  showCode
                  val={amount}
                  fontSize={7}
                  disableRounding
                />
              )}
            </Box>
            <Box mt={1} selectable>
              {hasFailed ? null : (
                <CounterValue
                  color="grey"
                  fontSize={5}
                  date={date}
                  currency={currency}
                  value={amount}
                />
              )}
            </Box>
          </Box>
          {subOperations.length > 0 && account.type === 'Account' && (
            <React.Fragment>
              <OpDetailsSection>
                {t('operationDetails.tokenOperations')}
                <LabelInfoTooltip
                  text={t('operationDetails.tokenTooltip')}
                  style={{ marginLeft: 4 }}
                />
              </OpDetailsSection>
              <Box>
                {subOperations.map((op, i) => {
                  const opAccount = (account.tokenAccounts || []).find(
                    acc => acc.id === op.accountId,
                  )

                  if (!opAccount) return null

                  return (
                    <NoMarginWrapper key={`${op.id}`}>
                      <OperationComponent
                        compact
                        text={opAccount.token.name}
                        operation={op}
                        account={opAccount}
                        parentAccount={account}
                        onOperationClick={() => openOperation('subOperation', op, operation)}
                        t={t}
                      />
                      {i < subOperations.length - 1 && <B />}
                    </NoMarginWrapper>
                  )
                })}
              </Box>
            </React.Fragment>
          )}

          {internalOperations.length > 0 && account.type === 'Account' && (
            <React.Fragment>
              <OpDetailsSection>
                {t('operationDetails.internalOperations')}
                <LabelInfoTooltip
                  text={t('operationDetails.internalOpTooltip')}
                  style={{ marginLeft: 4 }}
                />
              </OpDetailsSection>
              <Box>
                {internalOperations.map((op, i) => (
                  <NoMarginWrapper key={`${op.id}`}>
                    <OperationComponent
                      compact
                      text={account.currency.name}
                      operation={op}
                      account={account}
                      onOperationClick={() => openOperation('internalOperation', op, operation)}
                      t={t}
                    />
                    {i < internalOperations.length - 1 && <B />}
                  </NoMarginWrapper>
                ))}
              </Box>
            </React.Fragment>
          )}

          {internalOperations.length || subOperations.length ? (
            <OpDetailsSection mb={2}>
              {t('operationDetails.details', { currency: getAccountCurrency(account).name })}
            </OpDetailsSection>
          ) : null}

          <Box horizontal flow={2}>
            <Box flex={1}>
              <OpDetailsTitle>{t('operationDetails.account')}</OpDetailsTitle>
              <OpDetailsData>{name}</OpDetailsData>
            </Box>
            <Box flex={1}>
              <OpDetailsTitle>{t('operationDetails.date')}</OpDetailsTitle>
              <OpDetailsData>{moment(date).format('LLL')}</OpDetailsData>
            </Box>
          </Box>
          <B />
          <Box horizontal flow={2}>
            {type === 'OUT' && (
              <Box flex={1}>
                <OpDetailsTitle>{t('operationDetails.fees')}</OpDetailsTitle>
                {fee ? (
                  <Fragment>
                    <OpDetailsData>
                      <FormattedVal unit={mainAccount.unit} showCode val={fee} color="smoke" />
                      <Box horizontal>
                        <CounterValue
                          color="grey"
                          date={date}
                          fontSize={3}
                          currency={mainAccount.currency}
                          value={fee}
                          alwaysShowSign={false}
                          subMagnitude={1}
                          prefix={
                            <Box mr={1} color="grey" style={{ lineHeight: 1.2 }}>
                              {'≈'}
                            </Box>
                          }
                        />
                      </Box>
                    </OpDetailsData>
                  </Fragment>
                ) : (
                  <OpDetailsData>{t('operationDetails.noFees')}</OpDetailsData>
                )}
              </Box>
            )}
            <Box flex={1}>
              <OpDetailsTitle>{t('operationDetails.status')}</OpDetailsTitle>
              <OpDetailsData
                color={hasFailed ? 'alertRed' : isConfirmed ? 'positiveGreen' : null}
                horizontal
                flow={1}
              >
                <Box>
                  {hasFailed
                    ? t('operationDetails.failed')
                    : isConfirmed
                    ? t('operationDetails.confirmed')
                    : t('operationDetails.notConfirmed')}
                </Box>
                {hasFailed ? null : <Box>{`(${confirmations})`}</Box>}
              </OpDetailsData>
            </Box>
          </Box>
          <B />
          <Box>
            <OpDetailsTitle>{t('operationDetails.identifier')}</OpDetailsTitle>
            <OpDetailsData>
              <Ellipsis canSelect>{hash}</Ellipsis>
              <GradientHover>
                <CopyWithFeedback text={hash} />
              </GradientHover>
            </OpDetailsData>
          </Box>
          <B />
          <Box>
            <OpDetailsTitle>{t('operationDetails.from')}</OpDetailsTitle>
            <DataList lines={uniqueSenders} t={t} />
          </Box>
          <B />
          <Box>
            <OpDetailsTitle>{t('operationDetails.to')}</OpDetailsTitle>
            <DataList lines={recipients} t={t} />
          </Box>
          {Object.entries(extra).map(([key, value]) => (
            <Box key={key}>
              <OpDetailsTitle>
                <Trans i18nKey={`operationDetails.extra.${key}`} defaults={key} />
              </OpDetailsTitle>
              <OpDetailsData>{value}</OpDetailsData>
            </Box>
          ))}
        </Box>
      )}
      renderFooter={() =>
        url && (
          <Button primary onClick={() => openURL(url)}>
            {t('operationDetails.viewOperation')}
          </Button>
        )
      }
    >
      <TrackPage category="Modal" name="OperationDetails" />
    </ModalBody>
  )
})

type ModalRenderProps = {
  data: {
    account: string,
    operation: string,
  },
  onClose?: Function,
}

const OperationDetailsWrapper = ({ t }: { t: T }) => (
  <Modal
    name={MODAL_OPERATION_DETAILS}
    centered
    render={(props: ModalRenderProps) => {
      const { data, onClose } = props
      return <OperationDetails t={t} {...data} onClose={onClose} />
    }}
  />
)

export default translate()(OperationDetailsWrapper)

const More = styled(Text).attrs({
  ff: p => (p.ff ? p.ff : 'Museo Sans|Bold'),
  fontSize: p => (p.fontSize ? p.fontSize : 2),
  color: p => (p.color ? p.color : 'dark'),
  tabIndex: 0,
})`
  text-transform: ${p => (!p.textTransform ? 'auto' : 'uppercase')};
  outline: none;
`

export class DataList extends Component<{ lines: string[], t: T }, *> {
  state = {
    showMore: false,
  }
  onClick = () => {
    this.setState(({ showMore }) => ({ showMore: !showMore }))
  }
  render() {
    const { lines, t } = this.props
    const { showMore } = this.state
    // Hardcoded for now
    const numToShow = 2
    const shouldShowMore = lines.length > 3
    return (
      <Box>
        {(shouldShowMore ? lines.slice(0, numToShow) : lines).map(line => (
          <OpDetailsData key={line}>
            <Address>{line}</Address>
            <GradientHover>
              <CopyWithFeedback text={line} />
            </GradientHover>
          </OpDetailsData>
        ))}
        {shouldShowMore && !showMore && (
          <Box onClick={this.onClick} py={1}>
            <More fontSize={4} color="wallet" ff="Open Sans|SemiBold" mt={1}>
              <IconChevronRight size={12} style={{ marginRight: 5 }} />
              {t('operationDetails.showMore', { recipients: lines.length - numToShow })}
            </More>
          </Box>
        )}
        {showMore &&
          lines.slice(numToShow).map(line => (
            <OpDetailsData key={line}>
              <Address>{line}</Address>
              <GradientHover>
                <CopyWithFeedback text={line} />
              </GradientHover>
            </OpDetailsData>
          ))}
        {shouldShowMore && showMore && (
          <Box onClick={this.onClick} py={1}>
            <More fontSize={4} color="wallet" ff="Open Sans|SemiBold" mt={1}>
              <IconChevronRight size={12} style={{ marginRight: 5 }} />
              {t('operationDetails.showLess')}
            </More>
          </Box>
        )}
      </Box>
    )
  }
}

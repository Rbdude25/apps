// Copyright 2017-2024 @polkadot/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveOwnExposure } from '@polkadot/api-derive/types';
import type { LineData, Props } from './types.js';

import React, { useEffect, useMemo, useState } from 'react';

import { useApi, useCall } from '@polkadot/react-hooks';
import { BN, BN_ZERO, formatBalance } from '@polkadot/util';

import { useTranslation } from '../translate.js';
import Chart from './Chart.js';
import { balanceToNumber } from './util.js';

const COLORS_STAKE = [undefined, '#8c2200', '#acacac'];

function getExpText (exposures?: DeriveOwnExposure[]): 'paged' | 'clipped' {
  return exposures?.length && exposures[0].exposureMeta.isSome
    ? 'paged'
    : 'clipped';
}

function extractStakeLegacy (labels: string[], exposures: DeriveOwnExposure[], divisor: BN): LineData {
  const cliSet = new Array<number>(labels.length);
  const expSet = new Array<number>(labels.length);
  const avgSet = new Array<number>(labels.length);
  const [total, avgCount] = exposures.reduce(([total, avgCount], { clipped }) => {
    const cli = balanceToNumber(clipped.total?.unwrap(), divisor);

    if (cli > 0) {
      total += cli;
      avgCount++;
    }

    return [total, avgCount];
  }, [0, 0]);

  exposures.forEach(({ clipped, era, exposure }): void => {
    // Darwinia Crab doesn't have the total field
    const cli = balanceToNumber(clipped.total?.unwrap(), divisor);
    const exp = balanceToNumber(exposure.total?.unwrap(), divisor);
    const avg = avgCount > 0
      ? Math.ceil(total * 100 / avgCount) / 100
      : 0;
    const index = labels.indexOf(era.toHuman());

    if (index !== -1) {
      avgSet[index] = avg;
      cliSet[index] = cli;
      expSet[index] = exp;
    }
  });

  return [cliSet, expSet, avgSet];
}

function extractStake (labels: string[], exposures: DeriveOwnExposure[], divisor: BN): LineData {
  const expPagedSet = new Array<number>(labels.length);
  const expMetaSet = new Array<number>(labels.length);
  const avgSet = new Array<number>(labels.length);
  const [total, avgCount] = exposures.reduce(([total, avgCount], { exposureMeta }) => {
    const expMeta = exposureMeta.isSome && exposureMeta.unwrap();
    const expM = balanceToNumber((expMeta && expMeta.total?.unwrap()) || BN_ZERO, divisor);

    if (expM > 0) {
      total += expM;
      avgCount++;
    }

    return [total, avgCount];
  }, [0, 0]);

  exposures.forEach(({ era, exposureMeta, exposurePaged }): void => {
    const expPaged = exposurePaged.isSome && exposurePaged.unwrap();
    const expMeta = exposureMeta.isSome && exposureMeta.unwrap();
    // Darwinia Crab doesn't have the total field
    const expP = balanceToNumber((expPaged && expPaged.pageTotal?.unwrap()) || BN_ZERO, divisor);
    const expM = balanceToNumber((expMeta && expMeta.total?.unwrap()) || BN_ZERO, divisor);
    const avg = avgCount > 0
      ? Math.ceil(total * 100 / avgCount) / 100
      : 0;
    const index = labels.indexOf(era.toHuman());

    if (index !== -1) {
      avgSet[index] = avg;
      expPagedSet[index] = expP;
      expMetaSet[index] = expM;
    }
  });

  return [expPagedSet, expMetaSet, avgSet];
}

function ChartStake ({ labels, validatorId }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { api } = useApi();
  const params = useMemo(() => [validatorId, false], [validatorId]);
  const ownExposures = useCall<DeriveOwnExposure[]>(api.derive.staking.ownExposures, params);
  const [values, setValues] = useState<LineData>([]);
  const [expText, setExpText] = useState<'clipped'| 'paged'>('paged');

  const { currency, divisor } = useMemo(
    () => ({
      currency: formatBalance.getDefaults().unit,
      divisor: new BN('1'.padEnd(formatBalance.getDefaults().decimals + 1, '0'))
    }),
    []
  );

  useEffect(
    () => setExpText(getExpText(ownExposures)),
    [ownExposures]
  );

  useEffect(
    () => setValues([]),
    [validatorId]
  );

  useEffect(
    () => {
      ownExposures && setValues(
        ownExposures.length && ownExposures[0].exposureMeta.isSome
          ? extractStake(labels, ownExposures, divisor)
          : extractStakeLegacy(labels, ownExposures, divisor)
      );
    },
    [labels, divisor, ownExposures]
  );

  const legends = useMemo(() => [
    t('{{currency}} {{expText}}', { replace: { currency, expText } }),
    t('{{currency}} total', { replace: { currency } }),
    t('{{currency}} average', { replace: { currency } })
  ], [currency, expText, t]);

  return (
    <Chart
      colors={COLORS_STAKE}
      labels={labels}
      legends={legends}
      title={t('elected stake')}
      values={values}
    />
  );
}

export default React.memo(ChartStake);

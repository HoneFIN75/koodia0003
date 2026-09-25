export function buildRanking(players, tournamentResults, filter = 'ALL') {
  const totals = tournamentResults.reduce((accumulator, result) => {
    const current = accumulator.get(result.playerId) || {
      tournamentCount: 0,
      totalPoints: 0,
    };

    current.tournamentCount += 1;
    current.totalPoints += Number(result.calculatedPoints) || 0;
    accumulator.set(result.playerId, current);
    return accumulator;
  }, new Map());

  return players
    .filter((player) => filter === 'ALL' || player.division === filter)
    .map((player) => {
      const aggregate = totals.get(player.id) || { tournamentCount: 0, totalPoints: 0 };
      return {
        ...player,
        tournamentCount: aggregate.tournamentCount,
        totalPoints: aggregate.totalPoints,
      };
    })
    .sort((left, right) => {
      if (right.totalPoints === left.totalPoints) {
        return left.name.localeCompare(right.name, 'fi');
      }

      return right.totalPoints - left.totalPoints;
    });
}

export function getTopRanking(ranking, limit = 10) {
  return ranking.slice(0, limit);
}

export function getPlayerResults({ playerId, tournamentResults, tournaments }) {
  return tournamentResults
    .filter((result) => result.playerId === playerId)
    .map((result) => ({
      ...result,
      tournament: tournaments.find((tournament) => tournament.id === result.tournamentId) || null,
    }))
    .sort((left, right) => {
      const leftDate = left.tournament?.startDate || '';
      const rightDate = right.tournament?.startDate || '';
      return rightDate.localeCompare(leftDate);
    });
}

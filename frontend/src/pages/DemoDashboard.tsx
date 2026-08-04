import CeoExecutiveDemo from '../components/CeoExecutiveDemo';
import DeliveryLeadershipDemo from '../components/DeliveryLeadershipDemo';
import TeamMemberDemo from '../components/TeamMemberDemo';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';

const DemoDashboard = () => {
  const { demoPersona } = useAuth();
  const [searchParams] = useSearchParams();
  const planRequest = searchParams.get('plan') || undefined;

  return (
    <div className="demo-role-workspace">
      {demoPersona === 'team' && <TeamMemberDemo planRequest={planRequest} />}
      {demoPersona === 'delivery' && <DeliveryLeadershipDemo planRequest={planRequest} />}
      {(!demoPersona || demoPersona === 'ceo') && <CeoExecutiveDemo planRequest={planRequest} />}
    </div>
  );
};

export default DemoDashboard;

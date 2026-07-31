import CeoExecutiveDemo from '../components/CeoExecutiveDemo';
import DeliveryLeadershipDemo from '../components/DeliveryLeadershipDemo';
import TeamMemberDemo from '../components/TeamMemberDemo';
import { useAuth } from '../context/AuthContext';

const DemoDashboard = () => {
  const { demoPersona } = useAuth();

  return (
    <div className="demo-role-workspace">
      {demoPersona === 'team' && <TeamMemberDemo />}
      {demoPersona === 'delivery' && <DeliveryLeadershipDemo />}
      {(!demoPersona || demoPersona === 'ceo') && <CeoExecutiveDemo />}
    </div>
  );
};

export default DemoDashboard;

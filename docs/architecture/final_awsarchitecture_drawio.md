<mxGraphModel dx="1930" dy="1663" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="2800" pageHeight="1900" math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="title" value="AWS 프로덕션 아키텍처" style="text;strokeColor=none;fillColor=none;html=1;fontSize=24;fontStyle=1;verticalAlign=middle;align=center;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="900" y="20" width="1000" height="50" as="geometry" />
    </mxCell>
    <mxCell id="r53" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#8C4FFF;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.route_53;" parent="1" vertex="1">
      <mxGeometry x="1360" y="100" width="80" height="80" as="geometry" />
    </mxCell>
    <mxCell id="r53-label" value="Route 53&lt;br&gt;&lt;b&gt;DNS&lt;/b&gt;" style="text;html=1;fontSize=11;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1410" y="125" width="120" height="30" as="geometry" />
    </mxCell>
    <mxCell id="cf" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#8C4FFF;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.cloudfront;" parent="1" vertex="1">
      <mxGeometry x="1360" y="280" width="80" height="80" as="geometry" />
    </mxCell>
    <mxCell id="cf-label" value="CloudFront&lt;br&gt;&lt;b&gt;CDN&lt;/b&gt;" style="text;html=1;fontSize=11;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1410" y="305" width="120" height="30" as="geometry" />
    </mxCell>
    <mxCell id="s3-r" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#7AA116;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.s3;" parent="1" vertex="1">
      <mxGeometry x="1080" y="280" width="80" height="80" as="geometry" />
    </mxCell>
    <mxCell id="s3-r-label" value="S3&lt;br&gt;&lt;b&gt;React&lt;/b&gt;" style="text;html=1;fontSize=11;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1060" y="365" width="120" height="30" as="geometry" />
    </mxCell>
    <mxCell id="s3-s" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#7AA116;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.s3;" parent="1" vertex="1">
      <mxGeometry x="1640" y="280" width="80" height="80" as="geometry" />
    </mxCell>
    <mxCell id="s3-s-label" value="S3&lt;br&gt;&lt;b&gt;Storage&lt;/b&gt;" style="text;html=1;fontSize=11;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1620" y="240" width="120" height="30" as="geometry" />
    </mxCell>
    <mxCell id="vpc-bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#EDF6F9;strokeColor=#5A95BC;strokeWidth=1;dashed=1;" parent="1" vertex="1">
      <mxGeometry x="140" y="520" width="2520" height="1300" as="geometry" />
    </mxCell>
    <mxCell id="vpc-icon" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#5A95BC;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.vpc;" parent="1" vertex="1">
      <mxGeometry x="140" y="520" width="40" height="40" as="geometry" />
    </mxCell>
    <mxCell id="vpc-label" value="VPC 10.0.0.0/16 - 서울 리전 (ap-northeast-2)" style="text;html=1;fontSize=12;fontStyle=1;verticalAlign=middle;align=left;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="195" y="520" width="400" height="20" as="geometry" />
    </mxCell>
    <mxCell id="igw" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#8C4FFF;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.internet_gateway;" parent="1" vertex="1">
      <mxGeometry x="1360" y="560" width="80" height="80" as="geometry" />
    </mxCell>
    <mxCell id="igw-label" value="Internet Gateway" style="text;html=1;fontSize=11;fontStyle=0;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1340" y="645" width="120" height="30" as="geometry" />
    </mxCell>
    <mxCell id="alb" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#8C4FFF;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.application_load_balancer;" parent="1" vertex="1">
      <mxGeometry x="1360" y="740" width="80" height="80" as="geometry" />
    </mxCell>
    <mxCell id="alb-label" value="Application Load Balancer&lt;br&gt;&lt;b&gt;Multi-AZ + WebSocket 지원&lt;/b&gt;" style="text;html=1;fontSize=11;fontStyle=0;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1300" y="825" width="200" height="40" as="geometry" />
    </mxCell>
    <mxCell id="s3-endpoint" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#8C4FFF;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.endpoint;" parent="1" vertex="1">
      <mxGeometry x="1365" y="1200" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="s3-endpoint-label" value="S3 VPC Endpoint&lt;br&gt;&lt;b&gt;Gateway Type&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#388E3C&quot;&gt;NAT 비용 절감&lt;/font&gt;" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1310" y="1275" width="180" height="50" as="geometry" />
    </mxCell>
    <mxCell id="az-a-bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#F2F8EC;strokeColor=#879E6C;strokeWidth=1;dashed=1;" parent="1" vertex="1">
      <mxGeometry x="180" y="700" width="1080" height="1080" as="geometry" />
    </mxCell>
    <mxCell id="az-a-icon" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#879E6C;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.availability_zone;" parent="1" vertex="1">
      <mxGeometry x="180" y="700" width="35" height="35" as="geometry" />
    </mxCell>
    <mxCell id="az-a-label" value="Availability Zone A (ap-northeast-2a)" style="text;html=1;fontSize=12;fontStyle=1;verticalAlign=middle;align=left;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="215" y="707.5" width="300" height="20" as="geometry" />
    </mxCell>
    <mxCell id="pub-a-bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#E8F4E5;strokeColor=#6CAF5B;strokeWidth=1;" parent="1" vertex="1">
      <mxGeometry x="220" y="750" width="500" height="180" as="geometry" />
    </mxCell>
    <mxCell id="pub-a-icon" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#6CAF5B;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.public_subnet;" parent="1" vertex="1">
      <mxGeometry x="220" y="750" width="30" height="30" as="geometry" />
    </mxCell>
    <mxCell id="pub-a-label" value="Public subnet A (10.0.1.0/24)" style="text;html=1;fontSize=11;fontStyle=1;verticalAlign=middle;align=left;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="250" y="755" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="nat-a" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#8C4FFF;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.nat_gateway;" parent="1" vertex="1">
      <mxGeometry x="430" y="800" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="nat-a-label" value="NAT Gateway A&lt;br&gt;&lt;font color=&quot;#FF6F00&quot;&gt;(대안 경로)&lt;/font&gt;" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;fontStyle=1" parent="1" vertex="1">
      <mxGeometry x="405" y="875" width="120" height="40" as="geometry" />
    </mxCell>
    <mxCell id="priv-a-bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#E7F2F8;strokeColor=#5A95BC;strokeWidth=1;" parent="1" vertex="1">
      <mxGeometry x="220" y="960" width="500" height="340" as="geometry" />
    </mxCell>
    <mxCell id="priv-a-icon" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#5A95BC;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.private_subnet;" parent="1" vertex="1">
      <mxGeometry x="220" y="960" width="30" height="30" as="geometry" />
    </mxCell>
    <mxCell id="priv-a-label" value="Private subnet A (10.0.11.0/24)" style="text;html=1;fontSize=11;fontStyle=1;verticalAlign=middle;align=left;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="265" y="957" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="sg-ec2-a" value="" style="rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#E7711B;strokeWidth=1;dashed=1;" parent="1" vertex="1">
      <mxGeometry x="240" y="990" width="460" height="110" as="geometry" />
    </mxCell>
    <mxCell id="sg-ec2-a-label" value="SG-ECS (Port:3001)" style="text;html=1;fontSize=9;fontStyle=1;verticalAlign=top;align=left;fontColor=#E7711B;" parent="1" vertex="1">
      <mxGeometry x="245" y="993" width="120" height="15" as="geometry" />
    </mxCell>
    <mxCell id="ec2-a1" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.ecs;" parent="1" vertex="1">
      <mxGeometry x="270" y="1020" width="60" height="60" as="geometry" />
    </mxCell>
    <mxCell id="ec2-a1-label" value="ECS-1" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="255" y="1085" width="90" height="20" as="geometry" />
    </mxCell>
    <mxCell id="ec2-a2" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.ecs;" parent="1" vertex="1">
      <mxGeometry x="420" y="1020" width="60" height="60" as="geometry" />
    </mxCell>
    <mxCell id="ec2-a2-label" value="ECS-2" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="405" y="1085" width="90" height="20" as="geometry" />
    </mxCell>
    <mxCell id="ec2-a3" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.ecs;" parent="1" vertex="1">
      <mxGeometry x="570" y="1020" width="60" height="60" as="geometry" />
    </mxCell>
    <mxCell id="ec2-a3-label" value="ECS-3" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="555" y="1085" width="90" height="20" as="geometry" />
    </mxCell>
    <mxCell id="redis-pri" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.elasticache;" parent="1" vertex="1">
      <mxGeometry x="415" y="1180" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="redis-pri-label" value="Redis Primary&lt;br&gt;&lt;b&gt;Queue (Sorted Set)&lt;/b&gt;" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="375" y="1255" width="150" height="30" as="geometry" />
    </mxCell>
    <mxCell id="db-a-bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#F5EFF8;strokeColor=#9B59B6;strokeWidth=1;" parent="1" vertex="1">
      <mxGeometry x="220" y="1330" width="500" height="410" as="geometry" />
    </mxCell>
    <mxCell id="db-a-icon" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#9B59B6;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.private_subnet;" parent="1" vertex="1">
      <mxGeometry x="220" y="1330" width="30" height="30" as="geometry" />
    </mxCell>
    <mxCell id="db-a-label" value="DB Subnet A (10.0.21.0/24)" style="text;html=1;fontSize=11;fontStyle=1;verticalAlign=middle;align=left;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="265" y="1327" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="rds-pri" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.aurora;" parent="1" vertex="1">
      <mxGeometry x="415" y="1460" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="rds-pri-label" value="Aurora Primary&lt;br&gt;&lt;b&gt;읽기/쓰기&lt;/b&gt;" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="375" y="1535" width="150" height="30" as="geometry" />
    </mxCell>
    <mxCell id="az-b-bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#F2F8EC;strokeColor=#879E6C;strokeWidth=1;dashed=1;" parent="1" vertex="1">
      <mxGeometry x="1540" y="700" width="1080" height="1080" as="geometry" />
    </mxCell>
    <mxCell id="az-b-icon" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#879E6C;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.availability_zone;" parent="1" vertex="1">
      <mxGeometry x="1540" y="700" width="35" height="35" as="geometry" />
    </mxCell>
    <mxCell id="az-b-label" value="Availability Zone B (ap-northeast-2b)" style="text;html=1;fontSize=12;fontStyle=1;verticalAlign=middle;align=left;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="1575" y="707.5" width="300" height="20" as="geometry" />
    </mxCell>
    <mxCell id="pub-b-bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#E8F4E5;strokeColor=#6CAF5B;strokeWidth=1;" parent="1" vertex="1">
      <mxGeometry x="2080" y="750" width="500" height="180" as="geometry" />
    </mxCell>
    <mxCell id="pub-b-icon" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#6CAF5B;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.public_subnet;" parent="1" vertex="1">
      <mxGeometry x="2080" y="750" width="30" height="30" as="geometry" />
    </mxCell>
    <mxCell id="pub-b-label" value="Public subnet B (10.0.2.0/24)" style="text;html=1;fontSize=11;fontStyle=1;verticalAlign=middle;align=left;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="2110" y="755" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="nat-b" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#8C4FFF;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.nat_gateway;" parent="1" vertex="1">
      <mxGeometry x="2290" y="800" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="nat-b-label" value="NAT Gateway B&lt;br&gt;&lt;font color=&quot;#FF6F00&quot;&gt;(대안 경로)&lt;/font&gt;" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;fontStyle=1" parent="1" vertex="1">
      <mxGeometry x="2265" y="875" width="120" height="40" as="geometry" />
    </mxCell>
    <mxCell id="priv-b-bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#E7F2F8;strokeColor=#5A95BC;strokeWidth=1;" parent="1" vertex="1">
      <mxGeometry x="2080" y="960" width="500" height="340" as="geometry" />
    </mxCell>
    <mxCell id="priv-b-icon" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#5A95BC;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.private_subnet;" parent="1" vertex="1">
      <mxGeometry x="2080" y="960" width="30" height="30" as="geometry" />
    </mxCell>
    <mxCell id="priv-b-label" value="Private subnet B (10.0.12.0/24)" style="text;html=1;fontSize=11;fontStyle=1;verticalAlign=middle;align=left;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="2120" y="965" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="sg-ec2-b" value="" style="rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#E7711B;strokeWidth=1;dashed=1;" parent="1" vertex="1">
      <mxGeometry x="2100" y="990" width="460" height="110" as="geometry" />
    </mxCell>
    <mxCell id="sg-ec2-b-label" value="SG-ECS (Port:3001)" style="text;html=1;fontSize=9;fontStyle=1;verticalAlign=top;align=left;fontColor=#E7711B;" parent="1" vertex="1">
      <mxGeometry x="2105" y="993" width="120" height="15" as="geometry" />
    </mxCell>
    <mxCell id="ec2-b1" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.ecs;" parent="1" vertex="1">
      <mxGeometry x="2170" y="1020" width="60" height="60" as="geometry" />
    </mxCell>
    <mxCell id="ec2-b1-label" value="ECS-4" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="2155" y="1085" width="90" height="20" as="geometry" />
    </mxCell>
    <mxCell id="ec2-b2" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.ecs;" parent="1" vertex="1">
      <mxGeometry x="2340" y="1020" width="60" height="60" as="geometry" />
    </mxCell>
    <mxCell id="ec2-b2-label" value="ECS-5" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="2325" y="1085" width="90" height="20" as="geometry" />
    </mxCell>
    <mxCell id="redis-rep" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.elasticache;" parent="1" vertex="1">
      <mxGeometry x="2270" y="1180" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="redis-rep-label" value="Redis Replica&lt;br&gt;&lt;b&gt;Queue (Sorted Set)&lt;/b&gt;" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="2235" y="1255" width="150" height="30" as="geometry" />
    </mxCell>
    <mxCell id="db-b-bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#F5EFF8;strokeColor=#9B59B6;strokeWidth=1;" parent="1" vertex="1">
      <mxGeometry x="2080" y="1330" width="500" height="410" as="geometry" />
    </mxCell>
    <mxCell id="db-b-icon" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#9B59B6;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.private_subnet;" parent="1" vertex="1">
      <mxGeometry x="2080" y="1330" width="30" height="30" as="geometry" />
    </mxCell>
    <mxCell id="db-b-label" value="DB Subnet B (10.0.22.0/24)" style="text;html=1;fontSize=11;fontStyle=1;verticalAlign=middle;align=left;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="2120" y="1335" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="rds-rep" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.aurora;" parent="1" vertex="1">
      <mxGeometry x="2275" y="1460" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="rds-rep-label" value="Aurora Replica&lt;br&gt;&lt;b&gt;읽기 전용&lt;/b&gt;" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="2235" y="1535" width="150" height="30" as="geometry" />
    </mxCell>
    <mxCell id="lambda" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.lambda;" parent="1" vertex="1">
      <mxGeometry x="880" y="1380" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="lambda-label" value="Lambda&lt;br&gt;&lt;b&gt;Redis Queue 크기 측정&lt;/b&gt;&lt;br&gt;&lt;font size=&quot;1&quot;&gt;(1분 주기)&lt;/font&gt;" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="815" y="1455" width="200" height="45" as="geometry" />
    </mxCell>
    <mxCell id="cw" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#E7157B;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.cloudwatch_2;" parent="1" vertex="1">
      <mxGeometry x="1090" y="1380" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="cw-label" value="CloudWatch&lt;br&gt;&lt;b&gt;Alarms&lt;/b&gt;" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1045" y="1455" width="160" height="30" as="geometry" />
    </mxCell>
    <mxCell id="asg" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.auto_scaling2;" parent="1" vertex="1">
      <mxGeometry x="1365" y="1380" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="asg-label" value="Auto Scaling&lt;br&gt;&lt;b&gt;큐 크기 기반&lt;/b&gt;" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1310" y="1340" width="190" height="30" as="geometry" />
    </mxCell>
    <mxCell id="c1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=3;strokeColor=#545B64;" parent="1" source="r53" target="cf" edge="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="c2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#7AA116;" parent="1" source="cf" target="s3-r" edge="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="c3" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=3;strokeColor=#545B64;" parent="1" source="cf" target="igw" edge="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="c4" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=3;strokeColor=#545B64;" parent="1" source="igw" target="alb" edge="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="c5" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#545B64;" parent="1" source="alb" target="ec2-a1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="1200" y="780" />
          <mxPoint x="1200" y="920" />
          <mxPoint x="300" y="920" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c6" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#545B64;" parent="1" source="alb" target="ec2-a2" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="1200" y="780" />
          <mxPoint x="1200" y="920" />
          <mxPoint x="450" y="920" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c7" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#545B64;" parent="1" source="alb" target="ec2-a3" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="1200" y="780" />
          <mxPoint x="1200" y="920" />
          <mxPoint x="600" y="920" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c8" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#545B64;" parent="1" source="alb" target="ec2-b1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="1600" y="780" />
          <mxPoint x="1600" y="920" />
          <mxPoint x="2200" y="920" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c9" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#545B64;" parent="1" source="alb" target="ec2-b2" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="1600" y="780" />
          <mxPoint x="1600" y="920" />
          <mxPoint x="2370" y="920" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c10" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;" parent="1" source="ec2-a1" target="redis-pri" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="300" y="1130" />
          <mxPoint x="450" y="1130" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c11" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;" parent="1" source="ec2-a2" target="redis-pri" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="450" y="1130" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c12" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;" parent="1" source="ec2-a3" target="redis-pri" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="600" y="1130" />
          <mxPoint x="450" y="1130" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c13" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;" parent="1" source="ec2-b1" target="redis-rep" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="2200" y="1130" />
          <mxPoint x="2305" y="1130" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c14" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;" parent="1" source="ec2-b2" target="redis-rep" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="2370" y="1130" />
          <mxPoint x="2305" y="1130" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c15" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;dashed=1;" parent="1" source="redis-pri" target="redis-rep" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="1400" y="1215" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c16" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;" parent="1" source="ec2-a1" target="rds-pri" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="300" y="1360" />
          <mxPoint x="450" y="1360" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c17" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;" parent="1" source="ec2-a2" target="rds-pri" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="450" y="1360" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c18" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;" parent="1" source="ec2-a3" target="rds-pri" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="600" y="1360" />
          <mxPoint x="450" y="1360" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c19" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;" parent="1" source="ec2-b1" target="rds-rep" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="2200" y="1360" />
          <mxPoint x="2310" y="1360" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c20" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;" parent="1" source="ec2-b2" target="rds-rep" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="2370" y="1360" />
          <mxPoint x="2310" y="1360" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c21" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;dashed=1;" parent="1" source="rds-pri" target="rds-rep" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="1400" y="1495" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c22" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=1;strokeColor=#FF6F00;dashed=1;dashPattern=8 4;" parent="1" source="ec2-a1" target="nat-a" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="290" y="890" />
          <mxPoint x="465" y="890" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c23" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=1;strokeColor=#FF6F00;dashed=1;dashPattern=8 4;" parent="1" source="nat-a" target="igw" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="465" y="680" />
          <mxPoint x="1180" y="680" />
          <mxPoint x="1180" y="600" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c24" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=1;strokeColor=#FF6F00;dashed=1;dashPattern=8 4;" parent="1" source="igw" target="s3-s" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="1540" y="590" />
          <mxPoint x="1540" y="460" />
          <mxPoint x="1680" y="460" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c25" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=1;strokeColor=#FF6F00;dashed=1;dashPattern=8 4;" parent="1" source="ec2-b1" target="nat-b" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="2190" y="890" />
          <mxPoint x="2325" y="890" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c26" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=1;strokeColor=#FF6F00;dashed=1;dashPattern=8 4;" parent="1" source="nat-b" target="igw" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="2325" y="680" />
          <mxPoint x="1620" y="680" />
          <mxPoint x="1620" y="600" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c-vpc-endpoint-1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#388E3C;" parent="1" source="ec2-a2" target="s3-endpoint" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="750" y="1040" />
          <mxPoint x="750" y="1235" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c-vpc-endpoint-2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#388E3C;" parent="1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="2030" y="1050" />
          <mxPoint x="2030" y="1245" />
        </Array>
        <mxPoint x="2340" y="1050" as="sourcePoint" />
        <mxPoint x="1435" y="1245" as="targetPoint" />
      </mxGeometry>
    </mxCell>
    <mxCell id="c-vpc-endpoint-3" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#388E3C;" parent="1" source="s3-endpoint" target="s3-s" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="1410" y="450" />
          <mxPoint x="1670" y="450" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c27" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#ED7100;dashed=1;" parent="1" source="lambda" target="redis-pri" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="780" y="1415" />
          <mxPoint x="780" y="1220" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c28" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#ED7100;dashed=1;" parent="1" source="lambda" target="cw" edge="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="c29" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#ED7100;dashed=1;" parent="1" source="cw" target="asg" edge="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="c30" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#ED7100;dashed=1;" parent="1" source="asg" target="ec2-a3" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="1400" y="1570" />
          <mxPoint x="820" y="1570" />
          <mxPoint x="820" y="1060" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="c31" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#ED7100;dashed=1;" parent="1" source="asg" target="ec2-b1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="1400" y="1570" />
          <mxPoint x="1980" y="1570" />
          <mxPoint x="1980" y="1060" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="legend" value="" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#666666;strokeWidth=2;verticalAlign=top;align=left;fontSize=14;fontStyle=1;" parent="1" vertex="1">
      <mxGeometry x="710" y="180" width="280" height="235" as="geometry" />
    </mxCell>
    <mxCell id="leg-t1" value="연결선 설명" style="text;html=1;fontSize=12;fontStyle=1;verticalAlign=middle;align=left;" parent="1" vertex="1">
      <mxGeometry x="730" y="205" width="200" height="25" as="geometry" />
    </mxCell>
    <mxCell id="leg1" value="━━━ 사용자 트래픽 (HTTP/WebSocket)" style="text;html=1;fontSize=10;verticalAlign=middle;align=left;" parent="1" vertex="1">
      <mxGeometry x="790" y="235" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="leg-l1" style="edgeStyle=none;rounded=0;html=1;strokeWidth=3;strokeColor=#545B64;" parent="1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="730" y="245" as="sourcePoint" />
        <mxPoint x="780" y="245" as="targetPoint" />
      </mxGeometry>
    </mxCell>
    <mxCell id="leg2" value="━━━ DB/캐시 연결" style="text;html=1;fontSize=10;verticalAlign=middle;align=left;" parent="1" vertex="1">
      <mxGeometry x="790" y="260" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="leg-l2" style="edgeStyle=none;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;" parent="1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="730" y="270" as="sourcePoint" />
        <mxPoint x="780" y="270" as="targetPoint" />
      </mxGeometry>
    </mxCell>
    <mxCell id="leg3" value="━━━ S3 직접 연결 (VPC Endpoint)" style="text;html=1;fontSize=10;verticalAlign=middle;align=left;" parent="1" vertex="1">
      <mxGeometry x="790" y="285" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="leg-l3" style="edgeStyle=none;rounded=0;html=1;strokeWidth=2;strokeColor=#388E3C;" parent="1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="730" y="295" as="sourcePoint" />
        <mxPoint x="780" y="295" as="targetPoint" />
      </mxGeometry>
    </mxCell>
    <mxCell id="leg3-5" value="- - - S3 대안 경로 (NAT 경유)" style="text;html=1;fontSize=10;verticalAlign=middle;align=left;" parent="1" vertex="1">
      <mxGeometry x="790" y="310" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="leg-l3-5" style="edgeStyle=none;rounded=0;html=1;strokeWidth=1;strokeColor=#FF6F00;dashed=1;dashPattern=8 4;" parent="1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="730" y="320" as="sourcePoint" />
        <mxPoint x="780" y="320" as="targetPoint" />
      </mxGeometry>
    </mxCell>
    <mxCell id="leg4" value="- - - Auto Scaling 제어" style="text;html=1;fontSize=10;verticalAlign=middle;align=left;" parent="1" vertex="1">
      <mxGeometry x="790" y="335" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="leg-l4" style="edgeStyle=none;rounded=0;html=1;strokeWidth=2;strokeColor=#ED7100;dashed=1;" parent="1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="730" y="345" as="sourcePoint" />
        <mxPoint x="780" y="345" as="targetPoint" />
      </mxGeometry>
    </mxCell>
    <mxCell id="leg5" value="- - - 복제 (Replication)" style="text;html=1;fontSize=10;verticalAlign=middle;align=left;" parent="1" vertex="1">
      <mxGeometry x="790" y="360" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="leg-l5" style="edgeStyle=none;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;dashed=1;" parent="1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="730" y="370" as="sourcePoint" />
        <mxPoint x="780" y="370" as="targetPoint" />
      </mxGeometry>
    </mxCell>
  </root>
</mxGraphModel>
